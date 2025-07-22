// Configuración Firebase (usando tus credenciales)
const firebaseConfig = {
  apiKey: "AIzaSyBsBSSXjsK-EbdQGOsAycobtXNcMOAou9o",
  authDomain: "globo-2527e.firebaseapp.com",
  projectId: "globo-2527e",
  storageBucket: "globo-2527e.appspot.com",
  messagingSenderId: "1042384350668",
  appId: "1:1042384350668:web:6f78aca0b6799f53328169",
  measurementId: "G-293KTDMDQ1"
};

// Inicialización Firebase
try {
  firebase.initializeApp(firebaseConfig);
} catch (err) {
  console.error("Error en Firebase:", err);
}
const db = firebase.firestore();

// Variables globales
let scene, camera, renderer, globe;
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

// Mostrar loader mejorado
const loader = document.createElement('div');
loader.className = 'loader';
loader.innerHTML = `
  <div class="loader-content">
    <div class="loader-spinner"></div>
    <div class="loader-text">Cargando globo terrestre...</div>
  </div>
`;
document.body.appendChild(loader);

// Fuentes de textura en orden de prioridad
const textureSources = [
  'earth.jpg', // Primero intenta con la imagen local
  'assets/earth.jpg', // Ruta alternativa común
  'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg', // Respaldo remoto 1
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_1024.jpg' // Respaldo remoto 2
];

// Intentar cargar textura
loadTextureWithFallbacks(textureSources, 0);

function loadTextureWithFallbacks(sources, index) {
  if (index >= sources.length) {
    showError("No se pudo cargar ninguna textura del globo");
    createBasicGlobe(); // Crear globo básico como último recurso
    return;
  }

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    sources[index],
    (texture) => {
      initScene(texture);
      loader.remove();
    },
    (xhr) => {
      // Mostrar progreso de carga
      const progress = (xhr.loaded / xhr.total * 100).toFixed(0);
      const progressText = loader.querySelector('.loader-text');
      if (progressText) {
        progressText.textContent = `Cargando textura (${sources[index]}): ${progress}%`;
      }
    },
    (error) => {
      console.warn(`Error con fuente ${sources[index]}:`, error);
      loadTextureWithFallbacks(sources, index + 1); // Intentar siguiente fuente
    }
  );
}

function createBasicGlobe() {
  loader.querySelector('.loader-text').textContent = "Usando modo básico (sin textura)";
  
  // Crear escena básica
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.z = 3;

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(500, 500);
  document.getElementById('globe-container').appendChild(renderer.domElement);

  // Globo con color sólido
  const geometry = new THREE.SphereGeometry(1, 32, 32);
  const material = new THREE.MeshPhongMaterial({ 
    color: 0x1a75ff,
    specular: 0x111111,
    shininess: 5
  });
  globe = new THREE.Mesh(geometry, material);
  scene.add(globe);

  // Iluminación básica
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(5, 3, 5);
  scene.add(directionalLight);

  setupControls();
  initFunctions();
  animate();
}

function initScene(earthTexture) {
  // Escena Three.js
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.z = 3;

  // Renderer optimizado
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(500, 500);
  document.getElementById('globe-container').appendChild(renderer.domElement);

  // Crear globo terrestre con textura
  const globeGeometry = new THREE.SphereGeometry(1, 64, 64);
  const globeMaterial = new THREE.MeshPhongMaterial({
    map: earthTexture,
    shininess: 15,
    specular: new THREE.Color(0x111111),
    transparent: true,
    opacity: 1
  });
  
  globe = new THREE.Mesh(globeGeometry, globeMaterial);
  scene.add(globe);

  // Iluminación
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 3, 5);
  scene.add(directionalLight);

  // Controles
  setupControls();
  initFunctions();
  animate();
}

function setupControls() {
  let targetZoom = 3;
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };

  // Eventos de ratón
  function onMouseDown(e) {
    isDragging = true;
    isRotating = false;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  }

  function onMouseMove(e) {
    if (isDragging && globe) {
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };

      // Movimiento natural
      globe.rotation.y -= deltaMove.x * 0.004;
      globe.rotation.x -= deltaMove.y * 0.004;
      globe.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, globe.rotation.x));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  }

  function onMouseUp() {
    isDragging = false;
    isRotating = true;
  }

  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('mouseup', onMouseUp);
  renderer.domElement.addEventListener('mouseleave', onMouseUp);

  // Zoom natural
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetZoom += e.deltaY * -0.01;
    targetZoom = Math.max(1.5, Math.min(10, targetZoom));
  });

  // Botones UI
  document.getElementById('toggleRotation').addEventListener('click', () => {
    isRotating = !isRotating;
    document.getElementById('toggleRotation').textContent = 
      isRotating ? '⏸️ Pausar Rotación' : '▶️ Reiniciar Rotación';
  });

  document.getElementById('toggleDarkMode').addEventListener('click', toggleDarkMode);
  document.getElementById('toggleView').addEventListener('click', toggleView);
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
    }).setView([userLat || 0, userLng || 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  }
  updateMapMarkers();
}

function updateMapMarkers() {
  if (!map) return;
  
  // Limpiar marcadores existentes
  map.eachLayer(layer => {
    if (layer instanceof L.Marker) map.removeLayer(layer);
  });

  // Añadir nuevos marcadores
  userMarkers.forEach(marker => {
    const iconUrl = marker.isCurrentUser ? 
      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png' :
      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png';
    
    L.marker([marker.lat, marker.lng], {
      icon: new L.Icon({
        iconUrl: iconUrl,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
      })
    }).addTo(map).bindPopup(marker.labelText);
  });

  if (userLat !== 0 && userLng !== 0) {
    map.setView([userLat, userLng], 5);
  }
}

function animate() {
  requestAnimationFrame(animate);
  
  // Zoom suave
  if (camera) {
    camera.position.z += (targetZoom - camera.position.z) * 0.08;
  }
  
  // Rotación automática
  if (isRotating && !isDragging && globe) {
    globe.rotation.y += 0.003;
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
  
  // Actualizar marcadores
  updateMarkerPositions();
}

function updateMarkerPositions() {
  if (!userMarkers.length || !renderer || !camera) return;

  userMarkers.forEach(marker => {
    if (!marker.marker3D || !marker.label || !marker.marker2D) return;

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

function createUserMarker(lat, lng, labelText, isCurrentUser = true) {
  // Eliminar marcadores anteriores si es el usuario actual
  if (isCurrentUser) {
    userMarkers = userMarkers.filter(m => !m.isCurrentUser);
    if (scene) {
      scene.children = scene.children.filter(obj => !obj.userData?.isUserMarker);
    }
    document.querySelectorAll('.user-marker, .label.green').forEach(el => el.remove());
  }

  // Solo crear si tenemos escena
  if (!scene) return;

  // Marcador 3D
  const marker3D = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 16, 16),
    new THREE.MeshBasicMaterial({
      color: isCurrentUser ? 0xff0000 : 0x0000ff,
      transparent: true,
      opacity: 0.9
    })
  );
  marker3D.position.copy(latLngToVector3(lat, lng, 1.01));
  marker3D.userData = { isUserMarker: true };
  scene.add(marker3D);

  // Etiqueta HTML
  const label = document.createElement("div");
  label.className = `label ${isCurrentUser ? 'green' : 'blue'}`;
  label.textContent = labelText;
  document.getElementById('globe-container').appendChild(label);

  // Marcador 2D
  const marker2D = document.createElement("div");
  marker2D.className = isCurrentUser ? "user-marker" : "other-user-marker";
  document.getElementById('globe-container').appendChild(marker2D);

  userMarkers.push({
    lat, lng, labelText,
    marker3D, label, marker2D,
    isCurrentUser
  });

  if (!is3DView) updateMapMarkers();
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

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'firebase-error';
  errorDiv.textContent = message;
  document.body.appendChild(errorDiv);
  setTimeout(() => errorDiv.remove(), 5000);
}

// Inicialización de funciones
function initFunctions() {
  fetchUserLocation();
  setInterval(updateDateTimeDisplay, 1000);
}

async function fetchUserLocation() {
  try {
    const response = await fetch("https://ipapi.co/json/");
    if (!response.ok) throw new Error("Error en IPAPI");
    const data = await response.json();

    userLocationName = [
      data.city || "",
      data.region || "",
      data.country_name || ""
    ].filter(Boolean).join(", ");

    userLat = data.latitude;
    userLng = data.longitude;

    createUserMarker(userLat, userLng, userLocationName, true);
    await setupFirestore();
  } catch (error) {
    console.error("Error de ubicación:", error);
    createUserMarker(0, 0, "Ubicación no disponible", true);
  }
}

async function setupFirestore() {
  try {
    await db.collection('activeUsers').doc(userId).set({
      lat: userLat,
      lng: userLng,
      name: userLocationName,
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    });

    db.collection('activeUsers')
      .where('lastUpdate', '>', new Date(Date.now() - 5 * 60 * 1000))
      .onSnapshot(snapshot => {
        userMarkers = userMarkers.filter(marker => {
          if (marker.isCurrentUser) return true;
          if (scene) scene.remove(marker.marker3D);
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
      });

    await updateGlobalCounter();
  } catch (error) {
    console.error("Error en Firestore:", error);
  }
}

async function updateGlobalCounter() {
  try {
    const counterName = "globo_interactivo_visits";
    await fetch(`https://api.countapi.xyz/hit/${counterName}/total`);
    const response = await fetch(`https://api.countapi.xyz/get/${counterName}/total`);
    const data = await response.json();
    activeVisitors = Math.max(data.value || activeVisitors, activeVisitors);
    updateDateTimeDisplay();
  } catch (error) {
    console.error("Error en contador:", error);
  }
}

function updateDateTimeDisplay() {
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  const dateString = now.toLocaleDateString();
  document.getElementById("datario").textContent = 
    `Hora: ${timeString} - Fecha: ${dateString} - Visitantes: ${activeVisitors}`;
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initFunctions);
