// Configuración Firebase
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
firebase.initializeApp(firebaseConfig);
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

// Mostrar loader durante la carga
const loader = document.createElement('div');
loader.style.position = 'fixed';
loader.style.top = '50%';
loader.style.left = '50%';
loader.style.transform = 'translate(-50%, -50%)';
loader.style.color = 'white';
loader.style.backgroundColor = 'rgba(0,0,0,0.7)';
loader.style.padding = '20px';
loader.style.borderRadius = '10px';
loader.style.fontSize = '20px';
loader.style.zIndex = '1000';
loader.textContent = 'Cargando globo terrestre...';
document.body.appendChild(loader);

// Precargar textura antes de iniciar la escena
const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg',
  (texture) => {
    initScene(texture);
    loader.remove();
  },
  undefined,
  (error) => {
    console.error("Error cargando textura:", error);
    loader.textContent = 'Error cargando el globo. Recargue la página.';
    loader.style.color = '#ff5555';
  }
);

// Inicialización de la escena
function initScene(earthTexture) {
  // Escena Three.js
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.z = 3;

  const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(500, 500);
  renderer.domElement.style.display = 'block';
  document.getElementById('globe-container').appendChild(renderer.domElement);

  // Creación del globo (con textura precargada)
  const globeGeometry = new THREE.SphereGeometry(1, 64, 64);
  const globeMaterial = new THREE.MeshPhongMaterial({ 
    map: earthTexture,
    shininess: 15,
    transparent: true,
    opacity: 1
  });
  const globe = new THREE.Mesh(globeGeometry, globeMaterial);
  scene.add(globe);

  // Iluminación optimizada
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 3, 5);
  scene.add(directionalLight);

  // Variables de control
  let targetZoom = 3;
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };

  // Eventos de ratón CORREGIDOS
  renderer.domElement.addEventListener('mousedown', (e) => {
    isDragging = true;
    isRotating = false;
    previousMousePosition = {
      x: e.clientX,
      y: e.clientY
    };
  });

  renderer.domElement.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };

      // Movimiento corregido (no invertido y suave)
      globe.rotation.y -= deltaMove.x * 0.004;
      globe.rotation.x -= deltaMove.y * 0.004;

      // Limitar rotación vertical para evitar volteos
      globe.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, globe.rotation.x));

      previousMousePosition = {
        x: e.clientX,
        y: e.clientY
      };
    }
  });

  renderer.domElement.addEventListener('mouseup', () => {
    isDragging = false;
    isRotating = true;
  });

  renderer.domElement.addEventListener('mouseleave', () => {
    isDragging = false;
    isRotating = true;
  });

  // Zoom optimizado
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetZoom += e.deltaY * -0.01; // Invertido para zoom natural
    targetZoom = Math.max(1.5, Math.min(10, targetZoom));
    isRotating = false;
  });

  // Botón de rotación
  document.getElementById('toggleRotation').addEventListener('click', () => {
    isRotating = !isRotating;
    document.getElementById('toggleRotation').textContent = 
      isRotating ? '⏸️ Pausar Rotación' : '▶️ Reiniciar Rotación';
  });

  // Botón de modo oscuro
  document.getElementById('toggleDarkMode').addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    document.getElementById('toggleDarkMode').textContent = 
      darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
    if (map) map.invalidateSize();
  });

  // Botón para cambiar vista
  document.getElementById('toggleView').addEventListener('click', toggleView);

  function toggleView() {
    is3DView = !is3DView;
    document.getElementById('globe-container').style.opacity = is3DView ? '1' : '0';
    document.getElementById('map-container').style.opacity = is3DView ? '0' : '1';
    document.getElementById('globe-container').style.display = is3DView ? 'block' : 'none';
    document.getElementById('map-container').style.display = is3DView ? 'none' : 'block';
    if (!is3DView) init2DMap();
  }

  // Animación optimizada
  function animate() {
    requestAnimationFrame(animate);
    
    // Zoom suave
    camera.position.z += (targetZoom - camera.position.z) * 0.08;
    
    // Rotación automática cuando no se arrastra
    if (isRotating && !isDragging) {
      globe.rotation.y += 0.003;
    }
    
    renderer.render(scene, camera);
    
    // Actualizar marcadores si existen
    if (userMarkers.length > 0) {
      updateMarkerPositions();
    }
  }

  animate();

  // Inicialización de funciones restantes
  initFunctions();
}

function initFunctions() {
  // [Todas tus otras funciones (createUserMarker, fetchUserLocation, etc.)]
  // ... (mantén el resto de tus funciones como estaban)
}

// Funciones de marcadores y geolocalización (se mantienen igual)
function createUserMarker(lat, lng, labelText, isCurrentUser = true) {
  // ... (implementación existente)
}

function updateMarkerPositions() {
  // ... (implementación existente)
}

function fetchUserLocation() {
  // ... (implementación existente)
}

// Inicialización final
function init() {
  window.addEventListener("resize", () => {
    if (userMarkers.length > 0) updateMarkerPositions();
  });
  fetchUserLocation();
  setInterval(updateDateTimeDisplay, 1000);
}

document.addEventListener('DOMContentLoaded', init);
