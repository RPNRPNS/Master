// Variables globales
let visitCount = localStorage.getItem('visitCount') ? parseInt(localStorage.getItem('visitCount')) : 0;
visitCount++;
localStorage.setItem('visitCount', visitCount.toString());
let isRotating = true;
let userMarker3D = null;
let userLabel = null;
let userMarker2D = null;
let lastDragTime = 0;
let darkMode = false;
let is3DView = true;
let map = null;
let mapMarker = null;
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
            mapMarker = L.marker([userLat, userLng]).addTo(map)
                .bindPopup(userLocationName);
            map.setView([userLat, userLng], 5);
        }
    } else {
        if (userLat !== 0 && userLng !== 0) {
            if (mapMarker) {
                mapMarker.setLatLng([userLat, userLng]);
                mapMarker.setPopupContent(userLocationName);
            } else {
                mapMarker = L.marker([userLat, userLng]).addTo(map)
                    .bindPopup(userLocationName);
            }
            map.setView([userLat, userLng], 5);
        }
    }
}

function createUserMarker(lat, lng, labelText) {
    // Eliminar marcadores anteriores si existen
    if (userMarker3D) {
        globe.remove(userMarker3D);
        userMarker3D.geometry.dispose();
        userMarker3D.material.dispose();
    }
    if (userLabel) {
        document.getElementById('globe-container').removeChild(userLabel);
    }
    if (userMarker2D) {
        document.getElementById('globe-container').removeChild(userMarker2D);
    }

    // Crear marcador 3D
    const markerGeometry = new THREE.SphereGeometry(0.02, 32, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xff0000,
        transparent: true,
        opacity: 0.9
    });
    userMarker3D = new THREE.Mesh(markerGeometry, markerMaterial);
    userMarker3D.position.copy(convertLatLngToVector3(lat, lng, 1.01));
    globe.add(userMarker3D);

    // Guardar coordenadas
    userLat = lat;
    userLng = lng;
    userLocationName = labelText;

    // Etiqueta
    userLabel = document.createElement("div");
    userLabel.className = "label green";
    userLabel.textContent = labelText;
    document.getElementById('globe-container').appendChild(userLabel);

    // Marcador 2D
    userMarker2D = document.createElement("div");
    userMarker2D.className = "user-marker";
    document.getElementById('globe-container').appendChild(userMarker2D);

    // Actualizar mapa 2D si está visible
    if (!is3DView) {
        init2DMap();
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

function update2DPositions() {
    if (!userMarker3D || !userLabel || !userMarker2D) return;
    
    const vector = userMarker3D.getWorldPosition(new THREE.Vector3());
    const projected = vector.project(camera);
    
    const x = (projected.x * 0.5 + 0.5) * renderer.domElement.width;
    const y = (-projected.y * 0.5 + 0.5) * renderer.domElement.height;
    
    if (projected.z < 1) {
        userLabel.style.display = "block";
        userLabel.style.left = `${x}px`;
        userLabel.style.top = `${y}px`;
        
        userMarker2D.style.display = "block";
        userMarker2D.style.left = `${x}px`;
        userMarker2D.style.top = `${y}px`;
    } else {
        userLabel.style.display = "none";
        userMarker2D.style.display = "none";
    }
}

function fetchUserLocation() {
    fetch("https://ipapi.co/json/")
        .then(res => {
            if (!res.ok) throw new Error(`Error HTTP! estado: ${res.status}`);
            return res.json();
        })
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
            createUserMarker(data.latitude, data.longitude, userLocationName);
        })
        .catch(err => {
            console.error("Error obteniendo ubicación:", err);
            createUserMarker(0, 0, "Ubicación no disponible");
            if (userLabel) userLabel.classList.add('error');
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
    activeVisitors = visitCount;
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
        
        update2DPositions();
        renderer.render(scene, camera);
    }
}

// Inicialización
function init() {
    window.addEventListener("resize", update2DPositions);
    fetchUserLocation();
    setInterval(updateDateTimeDisplay, 1000);
    setInterval(updateVisitorCount, 5000);
    animateGlobe();
}

// Iniciar la aplicación cuando se cargue el DOM
document.addEventListener('DOMContentLoaded', init);