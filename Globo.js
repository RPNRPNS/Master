// Variables globales
let visitCount = localStorage.getItem('visitCount') ? parseInt(localStorage.getItem('visitCount')) : 0;
visitCount++;
localStorage.setItem('visitCount', visitCount.toString());
let isRotating = true;
let userMarkers = [];
let lastDragTime = 0;
let darkMode = false;
let is3DView = true;
let map = null;
let userLat = 0;
let userLng = 0;
let userLocationName = "";
let activeVisitors = visitCount;

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

// Zoom corregido (no invertido)
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

function fetchUserLocation() {
    // Obtener ubicación del usuario actual
    fetch("https://ipapi.co/json/")
        .then(res => res.json())
        .then(data => {
            const normalizeText = (text) => {
                return text ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
            };

            const city = normalizeText(data.city);
            const region = normalizeText(data.region);
            const country = normalizeText(data.country_name);

            const locationParts = [];
            if (city) locationParts.push(city);
            if (region && region !== city) locationParts.push(region);
            if (country) locationParts.push(country);

            userLocationName = locationParts.join(", ");
            userLat = data.latitude;
            userLng = data.longitude;

            createUserMarker(userLat, userLng, userLocationName, true);
            
            // Simular otros usuarios con la API de OpenStreetMap Nominatim
            fetchRandomLocations(5);
        })
        .catch(err => {
            console.error("Error obteniendo ubicación:", err);
            createUserMarker(0, 0, "Ubicación no disponible", true);
        });
}

function fetchRandomLocations(count) {
    const cities = ["Madrid", "Paris", "New York", "Tokyo", "Sydney", "Cairo", "Rio de Janeiro"];
    
    cities.slice(0, count).forEach(city => {
        fetch(`https://nominatim.openstreetmap.org/search?city=${city}&format=json`)
            .then(res => res.json())
            .then(data => {
                if (data && data.length > 0) {
                    const location = data[0];
                    createUserMarker(
                        parseFloat(location.lat),
                        parseFloat(location.lon),
                        city,
                        false
                    );
                }
            })
            .catch(err => console.error(`Error obteniendo ${city}:`, err));
    });
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

function updateVisitorCount() {
    // Usamos el contador local como base y sumamos los marcadores simulados
    activeVisitors = visitCount + userMarkers.filter(m => !m.isCurrentUser).length;
    updateDateTimeDisplay();
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
function init() {
    window.addEventListener("resize", updateMarkerPositions);
    fetchUserLocation();
    setInterval(updateDateTimeDisplay, 1000);
    setInterval(updateVisitorCount, 5000);
    animateGlobe();
}

// Iniciar la aplicación cuando se cargue el DOM
document.addEventListener('DOMContentLoaded', init);
