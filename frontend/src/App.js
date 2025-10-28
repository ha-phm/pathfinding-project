import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';

// Component để bắt sự kiện click trên map
function MapClickHandler({ onClick }) {
  useMapEvents({
    click: (e) => {
      onClick(e.latlng);
    },
  });
  return null;
}

// Icon cho marker
const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function App() {
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [path, setPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Tọa độ trung tâm Hai Bà Trưng, Hà Nội
  const center = [20.9995, 105.8463];

  const handleMapClick = (latlng) => {
    if (!startPoint) {
      setStartPoint(latlng);
      setEndPoint(null);
      setPath([]);
      setError('');
      console.log('Điểm bắt đầu:', latlng);
    } else if (!endPoint) {
      setEndPoint(latlng);
      console.log('Điểm kết thúc:', latlng);
      findPath(startPoint, latlng);
    } else {
      setStartPoint(latlng);
      setEndPoint(null);
      setPath([]);
      setError('');
      console.log('Reset - Điểm bắt đầu mới:', latlng);
    }
  };

  const findPath = async (start, end) => {
    setLoading(true);
    setError('');
    setPath([]);

    try {
      const response = await fetch('http://localhost:3001/findpath', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startLat: start.lat,
          startLon: start.lng,
          endLat: end.lat,
          endLon: end.lng,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Không thể tìm đường');
      }

      const data = await response.json();
      console.log('Tìm thấy đường đi:', data);
      setPath(data.path);
    } catch (err) {
      console.error('Lỗi:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStartPoint(null);
    setEndPoint(null);
    setPath([]);
    setError('');
  };

  return (
    <div className="App">
      <div className="header">
        <h1>🗺️ Tìm Đường Với Thuật Toán A*</h1>
        <p>Quận Hai Bà Trưng, Hà Nội</p>
      </div>
      
      {/* THÊM VÀO TRONG <div className="App">, sau <div className="header"> */}
<button
  onClick={async () => {
    try {
      const res = await fetch('http://localhost:3001/findpath', {

        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startLat: 21.0136,
          startLon: 105.8451,
          endLat: 21.0142,
          endLon: 105.8445,
        }),
      });
      const data = await res.json();
      alert('API OK: ' + JSON.stringify(data));
    } catch (err) {
      alert('Lỗi: ' + err.message);
    }
  }}
  style={{
    position: 'fixed',
    top: 10,
    right: 10,
    zIndex: 9999,
    padding: '12px 20px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: 'bold',
    cursor: 'pointer',
  }}
>
  TEST API
</button>

      <div className="controls">
        <div className="instructions">
          <h3>Hướng dẫn:</h3>
          <ol>
            <li>Click vào bản đồ để chọn <strong>điểm bắt đầu</strong> (marker xanh)</li>
            <li>Click lần nữa để chọn <strong>điểm kết thúc</strong> (marker đỏ)</li>
            <li>Hệ thống sẽ tự động tìm đường đi ngắn nhất</li>
            <li>Click "Reset" hoặc click lại trên bản đồ để chọn lại</li>
          </ol>
        </div>

        <div className="status">
          {!startPoint && <p className="info">📍 Chọn điểm bắt đầu...</p>}
          {startPoint && !endPoint && <p className="info">📍 Chọn điểm kết thúc...</p>}
          {loading && <p className="loading">⏳ Đang tìm đường...</p>}
          {error && <p className="error">❌ {error}</p>}
          {path.length > 0 && (
            <p className="success">
              ✅ Tìm thấy đường đi với {path.length} điểm
            </p>
          )}
        </div>

        <button onClick={handleReset} className="reset-btn">
          🔄 Reset
        </button>
      </div>

      <div className="map-container">
        <MapContainer
          center={center}
          zoom={14}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapClickHandler onClick={handleMapClick} />

          {startPoint && (
            <Marker position={[startPoint.lat, startPoint.lng]} icon={greenIcon} />
          )}

          {endPoint && (
            <Marker position={[endPoint.lat, endPoint.lng]} icon={redIcon} />
          )}

          {path.length > 0 && (
            <Polyline
              positions={path}
              color="blue"
              weight={4}
              opacity={0.7}
            />
          )}
        </MapContainer>
      </div>
    </div>
  );
}

export default App;