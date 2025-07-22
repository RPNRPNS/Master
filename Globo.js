// Importaciones Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-app.js";
import { getFirestore, doc, setDoc, collection, onSnapshot, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.6.0/firebase-analytics.js";

// Configuración Firebase (tus credenciales)
const firebaseConfig = {
  apiKey: "AIzaSyBsBSSXjsK-EbdQGOsAycobtXNcMOAou9o",
  authDomain: "globo-2527e.firebaseapp.com",
  projectId: "globo-2527e",
  storageBucket: "globo-2527e.firebasestorage.app",
  messagingSenderId: "1042384350668",
  appId: "1:1042384350668:web:6f78aca0b6799f53328169",
  measurementId: "G-293KTDMDQ1"
};

// Inicialización Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const analytics = getAnalytics(app);

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

// Cargador de texturas
const textureLoader = new THREE.TextureLoader();
let earthTexture = textureLoader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg');

// Creación del globo
const globeGeometry = new THREE.SphereGeometry(1, 64, 64);
const globeMaterial = new THREE.MeshPhongMaterial({ 
    map: earthTexture, 
    shininess: 15,
    transparent: true,
    opacity: 1
});
const globe = new THREE.Mesh(globeGeometry, globeMaterial);
scene.add(globe);

// Iluminación
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Variables para zoom
let targetZoom = 3;
const minZoom = 1.5;
const maxZoom = 10;
const zoomEasing = 0.1;

// Controles del ratón
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let rotationMomentum = 0;

// Eventos del ratón
renderer.domElement.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMousePosition = { 
        x: e.clientX - renderer.domElement.getBoundingClientRect().left, 
        y: e.clientY - renderer.domElement.getBoundingClientRect().top 
    };
    lastDragTime = Date.now();
});

renderer.domElement.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const rect = renderer.domElement.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        
        const deltaMove = {
            x: currentX - previousMousePosition.x,
            y: currentY - previousMousePosition.y
        };

        globe.rotation.y += deltaMove.x * 0.01;
        globe.rotation.x += deltaMove.y * 0.01;
        
        rotationMomentum = deltaMove.x * 0.0005;
        lastDragTime = Date.now();

        previousMousePosition = { x: currentX, y: currentY };
    }
});

renderer.domElement.addEventListener('mouseup', () => {
    isDragging = false;
    isRotating = Math.abs(rotationMomentum) > 0.0001;
});

renderer.domElement.addEventListener('mouseleave', () => {
    isDragging = false;
    isRotating = Math.abs(rotationMomentum) > 0.0001;
});

// Zoom
renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetZoom += e.deltaY * 0.01;
    targetZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));
    isRotating = false;
});

// Botón de rotación
document.getElementById('toggleRotation').addEventListener('click', () => {
    isRotating = !isRotating;
    rotationMomentum = 0;
    document.getElementById('toggleRotation').textContent = 
        isRotating ? '⏸️ Pausar Rotación' : '▶️ Reiniciar Rotación';
});

// Botón de modo oscuro
document.getElementById('toggleDarkMode').addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    document.getElementById('toggleDarkMode').textContent = 
        darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
    
    if (!is3DView && map) {
        map.invalidateSize();
    }
});

// Botón para cambiar vista
document.getElementById('toggleView').addEventListener('click', toggleView);

function toggleView() {
    is3DView = !is3DView;
    
    if (is3DView) {
        document.getElementById('globe-container').style.opacity = '0';
        document.getElementById('map-container').style.opacity = '0';
        
        setTimeout(() => {
            document.getElementById('globe-container').style.display = 'block';
            document.getElementById('map-container').style.display = 'none';
            setTimeout(() => {
                document.getElementById('globe-container').style.opacity = '1';
            }, 10);
        }, 300);
    } else {
        document.getElementById('globe-container').style.opacity = '0';
        document.getElementById('map-container').style.opacity = '0';
        
        setTimeout(() => {
            document.getElementById('globe-container').style.display = 'none';
            document.getElementById('map-container').style.display = 'block';
            init2DMap();
            setTimeout(() => {
                document.getElementById('map-container').style.opacity = '1';
            }, 10);
        }, 300);
    }
}

// Iconos para Leaflet
const redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const blueIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

function init2DMap() {
    if (!map) {
        map = L.map('map-container', {
            zoomControl: false,
            attributionControl: false
        }).setView([userLat || 0, userLng || 0], 3);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(map);
        
        if (userLat !== 0 && userLng !== 0) {
            L.marker([userLat, userLng], {icon: redIcon}).addTo(map)
                .bindPopup(userLocationName);
            map.setView([userLat, userLng], 5);
        }
    } else {
        if (userLat !== 0 && userLng !== 0) {
            map.setView([userLat, userLng], 5);
        }
    }
}

function createUserMarker(lat, lng, labelText, isCurrentUser = true) {
    // Marcador 3D
    const markerGeometry = new THREE.SphereGeometry(0.02, 32, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: isCurrentUser ? 0xff0000 : 0x0000ff,
        transparent: true,
        opacity: 0.9
    });
    const marker3D = new THREE.Mesh(markerGeometry, markerMaterial);
    marker3D.position.copy(convertLatLngToVector3(lat, lng, 1.01));
    globe.add(marker3D);

    // Etiqueta HTML
    const label = document.createElement("div");
    label.className = `label ${isCurrentUser ? 'green' : 'blue'}`;
    label.textContent = labelText;
    document.getElementById('globe-container').appendChild(label);

    // Marcador 2D (punto)
    const marker2D = document.createElement("div");
    marker2D.className = isCurrentUser ? "user-marker" : "other-user-marker";
    document.getElementById('globe-container').appendChild(marker2D);

    // Guardar referencia
    userMarkers.push({
        lat, lng, labelText,
        marker3D, label, marker2D,
        isCurrentUser
    });

    // Actualizar mapa 2D si está visible
    if (!is3DView && map) {
        if (isCurrentUser) {
            L.marker([lat, lng], {icon: redIcon}).addTo(map)
                .bindPopup(labelText);
        } else {
            L.marker([lat, lng], {icon: blueIcon}).addTo(map)
                .bindPopup(labelText);
        }
    }
}

function convertLatLngToVector3(lat, lng, radius) {
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
        
        if (projected.z < 1) {
            marker.label.style.display = "block";
            marker.label.style.left = `${x}px`;
            marker.label.style.top = `${y}px`;
            
            marker.marker2D.style.display = "block";
            marker.marker2D.style.left = `${x}px`;
            marker.marker2D.style.top = `${y}px`;
        } else {
            marker.label.style.display = "none";
            marker.marker2D.style.display = "none";
        }
    });
}

function showFirebaseError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'firebase-error';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

async function saveUserLocation(lat, lng, name) {
    try {
        await setDoc(doc(db, 'activeUsers', userId), {
            lat,
            lng,
            name,
            lastUpdate: serverTimestamp()
        });
    } catch (error) {
        showFirebaseError("Error guardando ubicación");
        console.error("Firebase error:", error);
    }
}

function setupRealTimeUpdates() {
    const q = query(
        collection(db, 'activeUsers'),
        where('lastUpdate', '>', new Date(Date.now() - 5 * 60 * 1000))
    );
    
    const unsubscribe = onSnapshot(q, {
        next: (snapshot) => {
            // Limpiar marcadores antiguos (excepto el actual)
            userMarkers.forEach(marker => {
                if (!marker.isCurrentUser) {
                    globe.remove(marker.marker3D);
                    if (marker.label && marker.label.parentNode) {
                        marker.label.parentNode.removeChild(marker.label);
                    }
                    if (marker.marker2D && marker.marker2D.parentNode) {
                        marker.marker2D.parentNode.removeChild(marker.marker2D);
                    }
                }
            });

            // Filtrar solo el usuario actual
            userMarkers = userMarkers.filter(m => m.isCurrentUser);

            // Añadir nuevos usuarios
            snapshot.forEach(doc => {
                const data = doc.data();
                if (doc.id !== userId) {
                    createUserMarker(data.lat, data.lng, data.name, false);
                }
            });

            // Actualizar contador
            activeVisitors = snapshot.size;
            updateDateTimeDisplay();
        },
        error: (error) => {
            showFirebaseError("Error en conexión en tiempo real");
            console.error("Firebase error:", error);
        }
    });

    return unsubscribe;
}

async function updateGlobalCounter() {
    try {
        const counterName = "globo_interactivo_visits_v2";
        await fetch(`https://api.countapi.xyz/hit/${counterName}/total`);
        const response = await fetch(`https://api.countapi.xyz/get/${counterName}/total`);
        const data = await response.json();
        activeVisitors = Math.max(data.value || 1, 1);
    } catch (error) {
        console.error("CountAPI error:", error);
        // Usamos Firestore como respaldo
        const q = query(collection(db, 'activeUsers'));
        const querySnapshot = await getDocs(q);
        activeVisitors = Math.max(querySnapshot.size || 1, 1);
    }
}

async function fetchUserLocation() {
    try {
        // Obtener ubicación del usuario
        const ipResponse = await fetch("https://ipapi.co/json/");
        if (!ipResponse.ok) throw new Error("Error en IPAPI");
        const data = await ipResponse.json();

        const normalizeText = (text) => text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
        userLocationName = [
            normalizeText(data.city),
            normalizeText(data.region),
            normalizeText(data.country_name)
        ].filter(Boolean).join(", ");

        userLat = data.latitude;
        userLng = data.longitude;

        // Crear marcador
        createUserMarker(userLat, userLng, userLocationName, true);
        
        // Guardar en Firebase y configurar actualizaciones
        await saveUserLocation(userLat, userLng, userLocationName);
        setupRealTimeUpdates();
        await updateGlobalCounter();

    } catch (error) {
        console.error("Location error:", error);
        createUserMarker(0, 0, "Ubicación no disponible", true);
    }
}

function updateDateTimeDisplay() {
    const now = new Date();
    const day = now.getDate().toString().padStart(2, '0');
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const year = now.getFullYear();
    const hour = now.getHours().toString().padStart(2, '0');
    const minute = now.getMinutes().toString().padStart(2, '0');
    const second = now.getSeconds().toString().padStart(2, '0');
    
    document.getElementById("datario").textContent = 
        `Hora: ${hour}:${minute}:${second} - Fecha: ${day}/${month}/${year} - Visitantes: ${activeVisitors}`;
}

// Animación principal
function animateGlobe() {
    requestAnimationFrame(animateGlobe);
    
    if (is3DView) {
        camera.position.z += (targetZoom - camera.position.z) * zoomEasing;
        
        if (isRotating) {
            if (rotationMomentum !== 0) {
                globe.rotation.y += rotationMomentum;
                rotationMomentum *= 0.95;
                if (Math.abs(rotationMomentum) < 0.0001) {
                    rotationMomentum = 0;
                }
            } else if (!isDragging) {
                globe.rotation.y += 0.005;
            }
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
    animateGlobe();
}

document.addEventListener('DOMContentLoaded', init);
