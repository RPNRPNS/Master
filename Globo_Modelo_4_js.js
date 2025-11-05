const firebaseConfig = {
  apiKey: "AIzaSyDmTiUq_qu-q0rnzpJj0onEDffq4kojAlc",
  authDomain: "globoradioperla.firebaseapp.com",
  projectId: "globoradioperla",
  storageBucket: "globoradioperla.firebasestorage.app",
  messagingSenderId: "269857063127",
  appId: "1:269857063127:web:6d83e10234953d93c7b092",
  measurementId: "G-TF0PBZBDNN"
};

// Inicializar Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase inicializado');
} catch (err) {
    console.error("Error en Firebase: " + err.message);
}

const db = firebase.firestore();

let isRotating = true;
window.userMarkers = [];
let darkMode = false;
let is3DView = true;
let isListView = false;
let map = null;
let userLat = 0;
let userLng = 0;
let userLocationName = "";
let userCountryCode = "";
let activeVisitors = 0;

const userId = "user_" + Math.random().toString(36).substring(2) + Date.now();
window.userId = userId;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(250, 250); // Cambiado de 500 a 250
document.getElementById('globe-container').appendChild(renderer.domElement);

const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg');
const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, 48, 48), // Reducida calidad para mejor rendimiento
    new THREE.MeshPhongMaterial({ 
        map: earthTexture, 
        shininess: 15,
        transparent: true,
        opacity: 1
    })
);
scene.add(globe);

scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

let targetZoom = 3;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationMomentum = 0;

setupEventListeners();

function setupEventListeners() {
    
    renderer.domElement.addEventListener('mousedown', (e) => {
        isDragging = true;
        previousMousePosition = { 
            x: e.clientX - renderer.domElement.offsetLeft, 
            y: e.clientY - renderer.domElement.offsetTop
        };
    });

    renderer.domElement.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const currentX = e.clientX - renderer.domElement.offsetLeft;
            const currentY = e.clientY - renderer.domElement.offsetTop;
            const deltaMove = {
                x: currentX - previousMousePosition.x,
                y: currentY - previousMousePosition.y
            };

            globe.rotation.y += deltaMove.x * 0.01;
            globe.rotation.x += deltaMove.y * 0.01;
            rotationMomentum = deltaMove.x * 0.0005;
            previousMousePosition = { x: currentX, y: currentY };
        }
    });

    renderer.domElement.addEventListener('mouseup', () => isDragging = false);
    renderer.domElement.addEventListener('mouseleave', () => isDragging = false);
    renderer.domElement.addEventListener('wheel', handleZoom);

    document.getElementById('toggleRotation').addEventListener('click', toggleRotation);
    document.getElementById('toggleDarkMode').addEventListener('click', toggleDarkMode);
    document.getElementById('toggleView').addEventListener('click', toggleView);
    document.getElementById('toggleListView').addEventListener('click', toggleListView);
}

function handleZoom(e) {
    e.preventDefault();
    targetZoom = Math.max(1.5, Math.min(10, targetZoom + e.deltaY * 0.01));
    isRotating = false;
}

function toggleRotation() {
    isRotating = !isRotating;
    rotationMomentum = 0;
    document.getElementById('toggleRotation').textContent = 
        isRotating ? '⏸️ Pausar' : '▶️ Reiniciar';
}

function toggleDarkMode() {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    document.getElementById('toggleDarkMode').textContent = 
        darkMode ? '☀️ Claro' : '🌙 Oscuro';
    if (map) map.invalidateSize();
}

function toggleView() {
    if (isListView) {
        toggleListView();
        return;
    }
    
    is3DView = !is3DView;
    isListView = false;
    
    document.getElementById('globe-container').style.opacity = is3DView ? '1' : '0';
    document.getElementById('map-container').style.opacity = is3DView ? '0' : '1';
    document.getElementById('globe-container').style.display = is3DView ? 'block' : 'none';
    document.getElementById('map-container').style.display = is3DView ? 'none' : 'block';
    document.getElementById('list-container').classList.remove('visible');
    
    document.getElementById('toggleView').textContent = 
        is3DView ? '🗺️ Mapa' : '🌍 Globo';
        
    if (!is3DView) init2DMap();
}

function toggleListView() {
    isListView = !isListView;
    
    document.getElementById('globe-container').style.display = isListView ? 'none' : 'block';
    document.getElementById('map-container').style.display = 'none';
    document.getElementById('list-container').classList.toggle('visible', isListView);
    
    document.getElementById('toggleListView').textContent = 
        isListView ? '🌍 Globo' : '📋 Lista';
    
    if (isListView) {
        updateLocationsList();
    } else {
        is3DView = true;
        document.getElementById('globe-container').style.display = 'block';
        document.getElementById('globe-container').style.opacity = '1';
    }
}

async function getCountryCode(lat, lng) {
    try {
        const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
        const targetUrl = `https://api.bigdatacloud.net/data/reverse-geocode?latitude=${lat}&longitude=${lng}&localityLanguage=es`;
        
        const response = await fetch(proxyUrl + targetUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            }
        });
        
        if (!response.ok) throw new Error('API falló');
        
        const data = await response.json();
        return data.countryCode || 'UN';
    } catch (error) {
        console.warn('⚠️ Error obteniendo país, usando coordenadas...');
        
        if (lat >= 35 && lat <= 45 && lng >= -10 && lng <= 5) return 'ES';
        if (lat >= 40 && lat <= 50 && lng >= -125 && lng <= -65) return 'US';
        if (lat >= -35 && lat <= 5 && lng >= -75 && lng <= -35) return 'BR';
        if (lat >= 55 && lat <= 70 && lng >= 10 && lng <= 30) return 'SE';
        if (lat >= 35 && lat <= 40 && lng >= -5 && lng <= 0) return 'ES';
        
        return 'UN';
    }
}

async function getLocationDetails(lat, lng) {
    try {
        const response = await fetch(`https://api.ipgeolocation.io/ipgeo?apiKey=demo&lat=${lat}&lon=${lng}`);
        if (!response.ok) throw new Error('API falló');
        
        const data = await response.json();
        return {
            countryCode: data.country_code2 || 'UN',
            countryName: data.country_name || 'Desconocido',
            city: data.city || 'Desconocida',
            region: data.state_prov || 'Desconocida'
        };
    } catch (error) {
        console.warn('⚠️ Error obteniendo detalles:', error);
        return {
            countryCode: 'UN',
            countryName: 'Desconocido',
            city: 'Desconocida',
            region: 'Desconocida'
        };
    }
}

function updateLocationsList() {
    const locationsList = document.getElementById('locations-list');
    const listStats = document.getElementById('list-stats');
    
    if (!locationsList || !listStats) {
        console.error('❌ No se encontraron elementos de la lista');
        return;
    }
    
    console.log('🔄 Actualizando lista de ubicaciones...');
    console.log('Marcadores disponibles:', window.userMarkers ? window.userMarkers.length : 0);
    
    const locationGroups = {};
    
    if (window.userMarkers && window.userMarkers.length > 0) {
        window.userMarkers.forEach(marker => {
            if (!marker || !marker.labelText) return;
            
            const locationKey = marker.labelText.trim() || 'Ubicación desconocida';
            
            if (!locationGroups[locationKey]) {
                locationGroups[locationKey] = {
                    name: locationKey,
                    count: 0,
                    isCurrentUser: marker.isCurrentUser,
                    coordinates: `${marker.lat?.toFixed(4) || '0.0000'}, ${marker.lng?.toFixed(4) || '0.0000'}`,
                    countryCode: marker.countryCode || 'UN',
                    markers: []
                };
            }
            
            locationGroups[locationKey].count++;
            locationGroups[locationKey].markers.push(marker);
        });
    }
    
    const sortedLocations = Object.values(locationGroups).sort((a, b) => b.count - a.count);
    
    console.log('📍 Ubicaciones agrupadas:', sortedLocations);
    
    locationsList.innerHTML = '';
    
    if (sortedLocations.length === 0) {
        locationsList.innerHTML = '<div class="empty-state">No hay ubicaciones activas</div>';
        listStats.textContent = 'Total: 0 ubicaciones - 0 personas';
        return;
    }
    
    sortedLocations.forEach((location, index) => {
        const locationItem = document.createElement('div');
        locationItem.className = `location-item ${location.isCurrentUser ? 'current-user' : ''}`;
        locationItem.setAttribute('data-location-index', index);
        
        const flagUrl = `https://flagsapi.com/${location.countryCode}/flat/24.png`;
        
        locationItem.innerHTML = `
            <div class="location-header">
                <div class="location-name-flag">
                    <img src="${flagUrl}" alt="${location.countryCode}" class="country-flag" 
                         onerror="this.src='https://flagsapi.com/UN/flat/24.png'">
                    <span class="location-name">${location.name}</span>
                </div>
            </div>
            <div class="location-stats">
                <span class="location-coordinates">${location.coordinates}</span>
                <span class="location-count">${location.count} persona${location.count > 1 ? 's' : ''}</span>
            </div>
        `;
        
        locationItem.addEventListener('dblclick', () => {
            if (location.markers.length > 0) {
                const firstMarker = location.markers[0];
                if (firstMarker.lat && firstMarker.lng) {
                    const mapsUrl = `https://www.google.com/maps?q=${firstMarker.lat},${firstMarker.lng}&z=15`;
                    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
                    console.log('🌍 Abriendo ubicación en Google Maps:', location.name);
                }
            }
        });
        
        locationItem.addEventListener('mouseenter', () => {
            locationItem.style.background = 'rgba(255, 255, 255, 0.25)';
            if (location.markers && location.markers.length > 0) {
                location.markers.forEach(marker => {
                    if (marker && marker.marker2D) {
                        marker.marker2D.style.transform = 'translate(-50%, -50%) scale(1.8)';
                        marker.marker2D.style.filter = 'brightness(1.8) drop-shadow(0 0 10px #00ff00)';
                        marker.marker2D.style.zIndex = '1000';
                    }
                    if (marker && marker.label) {
                        marker.label.style.transform = 'translate(-50%, -50%) scale(1.2)';
                        marker.label.style.zIndex = '1001';
                    }
                });
            }
        });
        
        locationItem.addEventListener('mouseleave', () => {
            locationItem.style.background = '';
            if (location.markers && location.markers.length > 0) {
                location.markers.forEach(marker => {
                    if (marker && marker.marker2D) {
                        marker.marker2D.style.transform = 'translate(-50%, -50%) scale(1)';
                        marker.marker2D.style.filter = 'brightness(1)';
                        marker.marker2D.style.zIndex = '100';
                    }
                    if (marker && marker.label) {
                        marker.label.style.transform = 'translate(-50%, -50%) scale(1)';
                        marker.label.style.zIndex = '101';
                    }
                });
            }
        });
        
        locationItem.addEventListener('click', (e) => {
            e.stopPropagation();
            locationItem.style.background = 'rgba(0, 168, 255, 0.3)';
            setTimeout(() => {
                if (locationItem.style.background.includes('0.3')) {
                    locationItem.style.background = '';
                }
            }, 300);
        });
        
        locationsList.appendChild(locationItem);
    });
    
    const totalLocations = sortedLocations.length;
    const totalPeople = sortedLocations.reduce((sum, loc) => sum + loc.count, 0);
    
    listStats.textContent = `Total: ${totalLocations} ubicación${totalLocations !== 1 ? 'es' : ''} - ${totalPeople} persona${totalPeople !== 1 ? 's' : ''}`;
    
    console.log('✅ Lista actualizada:', { totalLocations, totalPeople });
}

function init2DMap() {
    if (!map) {
        map = L.map('map-container', {
            zoomControl: false,
            attributionControl: false
        }).setView([userLat || 0, userLng || 0], 3);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    }
    updateMapMarkers();
}

function updateMapMarkers() {
    if (!map) return;
    map.eachLayer(layer => {
        if (layer instanceof L.Marker) map.removeLayer(layer);
    });

    window.userMarkers.forEach(marker => {
        L.marker([marker.lat, marker.lng], {
            icon: new L.Icon({
                iconUrl: marker.isCurrentUser 
                    ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png'
                    : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                iconSize: [20, 33], // Reducido tamaño
                iconAnchor: [10, 33]
            })
        }).addTo(map).bindPopup(marker.labelText);
    });

    if (userLat !== 0 && userLng !== 0) {
        map.setView([userLat, userLng], 5);
    }
}

async function createUserMarker(lat, lng, labelText, isCurrentUser = true) {
    
    let countryCode = 'UN';
    try {
        countryCode = await getCountryCode(lat, lng);
        console.log(`🇺🇳 País detectado: ${countryCode}`);
    } catch (error) {
        console.warn('⚠️ No se pudo obtener el país, usando valor por defecto');
    }
    
    const baseSize = 0.005; // Reducido de 0.008 a 0.005
    const marker3D = new THREE.Mesh(
        new THREE.SphereGeometry(baseSize, 12, 12), // Reducida calidad
        new THREE.MeshBasicMaterial({ 
            color: isCurrentUser ? 0xff0000 : 0x0000ff,
            transparent: true,
            opacity: 0.8
        })
    );
    marker3D.position.copy(latLngToVector3(lat, lng, 1.01));
    marker3D.userData = { baseSize: baseSize };
    globe.add(marker3D);

    const label = document.createElement("div");
    label.className = `label ${isCurrentUser ? 'green' : 'blue'}`;
    label.textContent = labelText;
    document.getElementById('globe-container').appendChild(label);

    const marker2D = document.createElement("div");
    
    if (isCurrentUser) {
        marker2D.className = "user-marker-optimized";
        marker2D.title = "Tu ubicación - Doble clic para abrir en Google Maps";
    } else {
        marker2D.className = "other-user-marker-optimized";
        marker2D.title = labelText + " - Doble clic para abrir en Google Maps";
    }
    
    document.getElementById('globe-container').appendChild(marker2D);

    const markerData = { 
        lat: parseFloat(lat), 
        lng: parseFloat(lng), 
        labelText, 
        marker3D, 
        label, 
        marker2D, 
        isCurrentUser,
        countryCode: countryCode
    };
    
    window.userMarkers.push(markerData);
    
    console.log('📍 Marcador creado:', { 
        label: markerData.labelText, 
        lat: markerData.lat, 
        lng: markerData.lng,
        country: markerData.countryCode
    });
    
    if (isListView) {
        updateLocationsList();
    }
    
    return markerData;
}

function updateMarkerSizes() {
    const zoomFactor = Math.max(0.5, Math.min(2, camera.position.z / 3));
    
    window.userMarkers.forEach(marker => {
        if (marker.marker3D.userData && marker.marker3D.userData.baseSize) {
            const targetSize = marker.marker3D.userData.baseSize * zoomFactor;
            
            const currentSize = marker.marker3D.geometry.parameters.radius;
            if (Math.abs(currentSize - targetSize) > 0.001) {
                marker.marker3D.geometry.dispose();
                marker.marker3D.geometry = new THREE.SphereGeometry(
                    targetSize, 
                    12, 
                    12
                );
            }
        }
    });
}

function latLngToVector3(lat, lng, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
        -radius * Math.sin(phi) * Math.cos(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}

function updateMarkerPositions() {
    window.userMarkers.forEach(marker => {
        const vector = marker.marker3D.getWorldPosition(new THREE.Vector3());
        const projected = vector.project(camera);
        
        const x = (projected.x * 0.5 + 0.5) * renderer.domElement.width;
        const y = (-projected.y * 0.5 + 0.5) * renderer.domElement.height;
        
        const isVisible = projected.z < 1;
        marker.label.style.display = isVisible ? "block" : "none";
        marker.marker2D.style.display = isVisible ? "block" : "none";
        
        if (isVisible) {
            marker.label.style.left = `${x}px`;
            marker.label.style.top = `${y}px`;
            marker.marker2D.style.left = `${x}px`;
            marker.marker2D.style.top = `${y}px`;
        }
    });
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'firebase-error';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

async function saveUserLocation(lat, lng, name) {
    try {
        await db.collection('activeUsers').doc(userId).set({
            lat,
            lng,
            name,
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (error) {
        console.error("Error guardando ubicación:", error);
    }
}

// =============================================
// SISTEMA SIMPLIFICADO - SOLO CONTADOR DE ACTIVOS
// =============================================

function setupRealTimeUpdates() {
    db.collection('activeUsers')
        .where('lastUpdate', '>', new Date(Date.now() - 20 * 1000)) 
        .onSnapshot(snapshot => {
            
            window.userMarkers = window.userMarkers.filter(marker => {
                if (marker.isCurrentUser) return true;
                globe.remove(marker.marker3D);
                marker.label.remove();
                marker.marker2D.remove();
                return false;
            });

            snapshot.forEach(doc => {
                const data = doc.data();
                if (doc.id !== userId) {
                    createUserMarker(data.lat, data.lng, data.name, false);
                }
            });

            activeVisitors = snapshot.size;
            updateDateTimeDisplay();
            
            if (isListView) {
                updateLocationsList();
            }
            
            if (!is3DView) updateMapMarkers();
            
            console.log('👥 Usuarios activos:', activeVisitors);
        }, error => {
            console.error("Error en tiempo real:", error);
        });
}

async function fetchUserLocation() {
    try {
        const response = await fetch("https://ipapi.co/json/");
        if (!response.ok) throw new Error('Error en ipapi.co');
        
        const data = await response.json();
        
        userLocationName = [
            data.city || "",
            data.region || "",
            data.country_name || ""
        ].filter(Boolean).join(", ");

        userLat = data.latitude;
        userLng = data.longitude;
        userCountryCode = data.country_code || 'UN';

        console.log('📍 Ubicación obtenida:', userLocationName);
        
        const countryCode = await getCountryCode(userLat, userLng);
        userCountryCode = countryCode;
        
        createUserMarker(userLat, userLng, userLocationName, true);
        
        try {
            await saveUserLocation(userLat, userLng, userLocationName);
        } catch (saveError) {
            console.warn('⚠️ Error guardando ubicación:', saveError);
        }
        
        setupRealTimeUpdates();
        updateDateTimeDisplay();
        console.log('📊 Usuarios activos:', activeVisitors);
        
    } catch (error) {
        console.error("❌ Error de ubicación:", error);
        
        userLocationName = "Ubicación no disponible";
        userLat = 40.4168;
        userLng = -3.7038;
        userCountryCode = 'ES';
        
        createUserMarker(userLat, userLng, userLocationName, true);
        updateDateTimeDisplay();
    }
}

function updateDateTimeDisplay() {
    const now = new Date();
    const timeElement = document.querySelector('.time-info');
    const dateElement = document.querySelector('.date-info');
    const activeElement = document.querySelector('.counter-active');
    
    if (timeElement) timeElement.textContent = `Hora: ${now.toLocaleTimeString()}`;
    if (dateElement) dateElement.textContent = `Fecha: ${now.toLocaleDateString()}`;
    if (activeElement) activeElement.textContent = `Activos: ${activeVisitors}`;
}

function animate() {
    requestAnimationFrame(animate);
    
    if (is3DView && !isListView) {
        
        camera.position.z += (targetZoom - camera.position.z) * 0.1;
        
        if (isRotating && !isDragging) {
            globe.rotation.y -= rotationMomentum || 0.005;
            if (rotationMomentum) rotationMomentum *= 0.95;
        }
        
        updateMarkerSizes();
        
        updateMarkerPositions();
        renderer.render(scene, camera);
    }
}

async function init() {
    window.addEventListener("resize", updateMarkerPositions);
    
    if (typeof showLoadingScreen === 'function') {
        showLoadingScreen();
    }
    
    console.log('🚀 Iniciando aplicación...');
    
    await fetchUserLocation();
    
    setInterval(updateDateTimeDisplay, 1000);
    
    setInterval(() => {
        if (userLat !== 0 && userLng !== 0) {
            saveUserLocation(userLat, userLng, userLocationName);
        }
    }, 30000);
    
    animate();
    
    setTimeout(() => {
        if (typeof hideLoadingScreen === 'function') {
            hideLoadingScreen();
        }
    }, 2000);
}

document.addEventListener('DOMContentLoaded', init);