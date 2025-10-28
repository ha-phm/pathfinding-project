const express = require('express');
const cors = require('cors');
const fs = require('fs');
const xml2js = require('xml2js');

const app = express();
app.use(cors());
app.use(express.json());

// Biến lưu trữ graph
let nodes = new Map();
let graph = new Map();

// Hàm tính khoảng cách Haversine (km)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Đọc và parse file OSM
async function parseOSMFile(filepath) {
  console.log('Đang đọc file OSM...');
  const xmlData = fs.readFileSync(filepath, 'utf8');
  
  const parser = new xml2js.Parser();
  const result = await parser.parseStringPromise(xmlData);
  
  console.log('Đang xử lý nodes...');
  if (result.osm.node) {
    result.osm.node.forEach(node => {
      const id = node.$.id;
      const lat = parseFloat(node.$.lat);
      const lon = parseFloat(node.$.lon);
      nodes.set(id, { lat, lon });
    });
  }
  
  console.log(`Đã load ${nodes.size} nodes`);
  
  console.log('Đang xây dựng graph...');
  if (result.osm.way) {
    result.osm.way.forEach(way => {
      const tags = way.tag || [];
      
      // Chấp nhận nhiều loại đường hơn
      const isRoad = tags.some(tag => tag.$.k === 'highway');
      
      if (!isRoad || !way.nd) return;
      
      const nodeRefs = way.nd.map(nd => nd.$.ref);
      
      // Tạo edges giữa các node liên tiếp
      for (let i = 0; i < nodeRefs.length - 1; i++) {
        const fromId = nodeRefs[i];
        const toId = nodeRefs[i + 1];
        
        if (!nodes.has(fromId) || !nodes.has(toId)) continue;
        
        const fromNode = nodes.get(fromId);
        const toNode = nodes.get(toId);
        const distance = haversineDistance(
          fromNode.lat, fromNode.lon,
          toNode.lat, toNode.lon
        );
        
        if (!graph.has(fromId)) graph.set(fromId, []);
        graph.get(fromId).push({ neighborId: toId, distance });
        
        if (!graph.has(toId)) graph.set(toId, []);
        graph.get(toId).push({ neighborId: fromId, distance });
      }
    });
  }
  
  console.log(`Đã xây dựng graph với ${graph.size} nodes có kết nối`);
}

// Tìm node gần nhất với tọa độ cho trước
function findNearestNode(lat, lon) {
  let minDist = Infinity;
  let nearestId = null;
  
  for (const [id, node] of nodes.entries()) {
    if (!graph.has(id)) continue;
    
    const dist = haversineDistance(lat, lon, node.lat, node.lon);
    if (dist < minDist) {
      minDist = dist;
      nearestId = id;
    }
  }
  
  return nearestId;
}

// Priority Queue đơn giản
class PriorityQueue {
  constructor() {
    this.items = [];
  }
  
  enqueue(item, priority) {
    this.items.push({ item, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }
  
  dequeue() {
    return this.items.shift();
  }
  
  isEmpty() {
    return this.items.length === 0;
  }
}

// Thuật toán A* cải tiến
function aStar(startId, goalId) {
  if (!graph.has(startId) || !graph.has(goalId)) {
    return null;
  }
  
  const openSet = new PriorityQueue();
  const closedSet = new Set();
  const cameFrom = new Map();
  const gScore = new Map();
  
  gScore.set(startId, 0);
  
  const goalNode = nodes.get(goalId);
  const startNode = nodes.get(startId);
  const heuristic = haversineDistance(
    startNode.lat, startNode.lon,
    goalNode.lat, goalNode.lon
  );
  
  openSet.enqueue(startId, heuristic);
  
  let iterations = 0;
  const maxIterations = 50000; // Tăng giới hạn iterations
  
  while (!openSet.isEmpty() && iterations < maxIterations) {
    iterations++;
    
    const { item: current } = openSet.dequeue();
    
    if (current === goalId) {
      console.log(`Tìm thấy đường sau ${iterations} iterations`);
      const path = [current];
      let temp = current;
      while (cameFrom.has(temp)) {
        temp = cameFrom.get(temp);
        path.unshift(temp);
      }
      return path;
    }
    
    closedSet.add(current);
    
    const neighbors = graph.get(current) || [];
    for (const { neighborId, distance } of neighbors) {
      if (closedSet.has(neighborId)) continue;
      
      const tentativeG = gScore.get(current) + distance;
      
      if (!gScore.has(neighborId) || tentativeG < gScore.get(neighborId)) {
        cameFrom.set(neighborId, current);
        gScore.set(neighborId, tentativeG);
        
        const neighborNode = nodes.get(neighborId);
        const h = haversineDistance(
          neighborNode.lat, neighborNode.lon,
          goalNode.lat, goalNode.lon
        );
        const f = tentativeG + h;
        
        openSet.enqueue(neighborId, f);
      }
    }
  }
  
  console.log(`Không tìm thấy đường sau ${iterations} iterations`);
  return null;
}

// API Endpoints
app.post('/findpath', (req, res) => {
  try {
    const { startLat, startLon, endLat, endLon } = req.body;
    
    console.log(`\n=== Tìm đường từ (${startLat}, ${startLon}) đến (${endLat}, ${endLon}) ===`);
    
    const startTime = Date.now();
    
    const startId = findNearestNode(startLat, startLon);
    const endId = findNearestNode(endLat, endLon);
    
    if (!startId || !endId) {
      return res.status(404).json({ error: 'Không tìm thấy node gần điểm chọn' });
    }
    
    console.log(`Start node: ${startId}, End node: ${endId}`);
    
    const pathIds = aStar(startId, endId);
    
    if (!pathIds) {
      return res.status(404).json({ 
        error: 'Không tìm thấy đường đi. Thử chọn 2 điểm gần nhau hơn hoặc trên cùng một con đường.' 
      });
    }
    
    const pathCoords = pathIds.map(id => {
      const node = nodes.get(id);
      return [node.lat, node.lon];
    });
    
    // Tính tổng khoảng cách
    let totalDist = 0;
    for (let i = 0; i < pathCoords.length - 1; i++) {
      totalDist += haversineDistance(
        pathCoords[i][0], pathCoords[i][1],
        pathCoords[i + 1][0], pathCoords[i + 1][1]
      );
    }
    
    const endTime = Date.now();
    console.log(`Hoàn thành trong ${endTime - startTime}ms`);
    console.log(`Khoảng cách: ${(totalDist * 1000).toFixed(0)}m với ${pathCoords.length} điểm\n`);
    
    res.json({ 
      path: pathCoords,
      distance: totalDist,
      points: pathCoords.length
    });
  } catch (error) {
    console.error('Lỗi:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/status', (req, res) => {
  res.json({ 
    nodes: nodes.size, 
    graphNodes: graph.size,
    status: 'OK'
  });
});

// Khởi động server
const PORT = 3001;

parseOSMFile('./haibatrung.osm')
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server đang chạy tại http://localhost:${PORT}`);
      console.log(`Sẵn sàng xử lý yêu cầu tìm đường!`);
    });
  })
  .catch(err => {
    console.error('Lỗi khi load file OSM:', err);
  });