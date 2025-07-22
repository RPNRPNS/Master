// Configuración Firebase (usa tus credenciales)
const firebaseConfig = {
    apiKey: "AIzaSyBsBSSXjsK-EbdQGOsAycobtXNcMOAou9o",
    authDomain: "globo-2527e.firebaseapp.com",
    projectId: "globo-2527e",
    storageBucket: "globo-2527e.firebasestorage.app",
    messagingSenderId: "1042384350668",
    appId: "1:1042384350668:web:6f78aca0b6799f53328169",
    measurementId: "G-293KTDMDQ1"
};

// Inicialización Firebase (versión compatibilidad)
try {
    firebase.initializeApp(firebaseConfig);
} catch (err) {
    showError("Error en Firebase: " + err.message);
}
const db = firebase.firestore();

// Variables globales
let isRotating = true;
let userMarkers = [];
let darkMode = false;
let is3DView = true;
let map = null;
let userLat = 0;
let userLng = 0;
let userLocationName = "";
let activeVisitors = 1;
const userId = "user_" + Math.random().toString(36).substring(2) + Date.now();

// Escena Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
camera.position.z = 3;

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(500, 500);
document.getElementById('globe-container').appendChild(renderer.domElement);

// Textura de la Tierra
const textureLoader = new THREE.TextureLoader();
const earthTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg');
const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.MeshPhongMaterial({ 
        map: earthTexture, 
        shininess: 15,
        transparent: true,
        opacity: 1
    })
);
scene.add(globe);

// Iluminación
scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Controles
let targetZoom = 3;
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationMomentum = 0;

// Eventos
setupEventListeners();

// Funciones principales
function setupEventListeners() {
    // Eventos de ratón
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

    // Botones UI
    document.getElementById('toggleRotation').addEventListener('click', toggleRotation);
    document.getElementById('toggleDarkMode').addEventListener('click', toggleDarkMode);
    document.getElementById('toggleView').addEventListener('click', toggleView);
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
        isRotating ? '⏸️ Pausar Rotación' : '▶️ Reiniciar Rotación';
}

function toggleDarkMode() {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    document.getElementById('toggleDarkMode').textContent = 
        darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
    if (map) map.invalidateSize();
}

function toggleView() {
    is3DView = !is3DView;
    document.getElementById('globe-container').style.opacity = is3DView ? '1' : '0';
    document.getElementById('map-container').style.opacity = is3DView ? '0' : '1';
    document.getElementById('globe-container').style.display = is3DView ? 'block' : 'none';
    document.getElementById('map-container').style.display = is3DView ? 'none' : 'block';
    if (!is3DView) init2DMap();
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

    userMarkers.forEach(marker => {
        L.marker([marker.lat, marker.lng], {
            icon: new L.Icon({
                iconUrl: marker.isCurrentUser 
                    ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png'
                    : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41]
            })
        }).addTo(map).bindPopup(marker.labelText);
    });

    if (userLat !== 0 && userLng !== 0) {
        map.setView([userLat, userLng], 5);
    }
}

function createUserMarker(lat, lng, labelText, isCurrentUser = true) {
    // Marcador 3D
    const marker3D = new THREE.Mesh(
        new THREE.SphereGeometry(0.02, 32, 32),
        new THREE.MeshBasicMaterial({ 
            color: isCurrentUser ? 0xff0000 : 0x0000ff,
            transparent: true,
            opacity: 0.9
        })
    );
    marker3D.position.copy(latLngToVector3(lat, lng, 1.01));
    globe.add(marker3D);

    // Etiqueta HTML
    const label = document.createElement("div");
    label.className = `label ${isCurrentUser ? 'green' : 'blue'}`;
    label.textContent = labelText;
    document.getElementById('globe-container').appendChild(label);

    // Marcador 2D
    const marker2D = document.createElement("div");
    marker2D.className = isCurrentUser ? "user-marker" : "other-user-marker";
    document.getElementById('globe-container').appendChild(marker2D);

    userMarkers.push({ lat, lng, labelText, marker3D, label, marker2D, isCurrentUser });
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
    userMarkers.forEach(marker => {
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
        showError("Error guardando ubicación");
        console.error(error);
    }
}

function setupRealTimeUpdates() {
    db.collection('activeUsers')
        .where('lastUpdate', '>', new Date(Date.now() - 5 * 60 * 1000))
        .onSnapshot(snapshot => {
            // Limpiar marcadores antiguos
            userMarkers = userMarkers.filter(marker => {
                if (marker.isCurrentUser) return true;
                globe.remove(marker.marker3D);
                marker.label.remove();
                marker.marker2D.remove();
                return false;
            });

            // Añadir nuevos
            snapshot.forEach(doc => {
                const data = doc.data();
                if (doc.id !== userId) {
                    createUserMarker(data.lat, data.lng, data.name, false);
                }
            });

            // Actualizar contador
            activeVisitors = snapshot.size;
            updateDateTimeDisplay();
            if (!is3DView) updateMapMarkers();
        }, error => {
            showError("Error en tiempo real");
            console.error(error);
        });
}

async function updateGlobalCounter() {
    try {
        const counterName = "globo_interactivo_visits";
        await fetch(`https://api.countapi.xyz/hit/${counterName}/total`);
        const response = await fetch(`https://api.countapi.xyz/get/${counterName}/total`);
        const data = await response.json();
        activeVisitors = Math.max(data.value, activeVisitors);
    } catch (error) {
        console.error("Error en contador:", error);
    }
}

async function fetchUserLocation() {
    try {
        const response = await fetch("https://ipapi.co/json/");
        const data = await response.json();
        
        userLocationName = [
            data.city || "",
            data.region || "",
            data.country_name || ""
        ].filter(Boolean).join(", ");

        userLat = data.latitude;
        userLng = data.longitude;

        createUserMarker(userLat, userLng, userLocationName, true);
        await saveUserLocation(userLat, userLng, userLocationName);
        setupRealTimeUpdates();
        await updateGlobalCounter();
    } catch (error) {
        console.error("Error de ubicación:", error);
        createUserMarker(0, 0, "Ubicación no disponible", true);
    }
}

function updateDateTimeDisplay() {
    const now = new Date();
    document.getElementById("datario").textContent = 
        `Hora: ${now.toLocaleTimeString()} - Fecha: ${now.toLocaleDateString()} - Visitantes: ${activeVisitors}`;
}

function animate() {
    requestAnimationFrame(animate);
    
    if (is3DView) {
        // Zoom suave
        camera.position.z += (targetZoom - camera.position.z) * 0.1;
        
        // Rotación automática
        if (isRotating && !isDragging) {
            globe.rotation.y += rotationMomentum || 0.005;
            if (rotationMomentum) rotationMomentum *= 0.95;
        }
        
        updateMarkerPositions();
        renderer.render(scene, camera);
    }
}

// Inicialización
async function init() {
    window.addEventListener("resize", updateMarkerPositions);
    await fetchUserLocation();
    setInterval(updateDateTimeDisplay, 1000);
    animate();
}

document.addEventListener('DOMContentLoaded', init);
