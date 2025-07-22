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
try {
  firebase.initializeApp(firebaseConfig);
} catch (err) {
  showError("Error en Firebase: " + err.message);
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

// Mostrar loader
const loader = document.createElement('div');
loader.className = 'loader';
loader.textContent = 'Cargando globo terrestre...';
document.body.appendChild(loader);

// Fuentes alternativas para la textura (por orden de prioridad)
const textureSources = [
  'https://threejs.org/examples/textures/planets/earth_atmos_1024.jpg', // Versión ligera oficial
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_1024.jpg', // Mirror GitHub
  'https://assets.codepen.io/476312/earth_atmos_1024.jpg', // CDN alternativo
  'assets/earth_atmos_1024.jpg' // Local fallback
];

// Intentar cargar textura de múltiples fuentes
loadTextureWithFallbacks(textureSources, 0);

function loadTextureWithFallbacks(sources, index) {
  if (index >= sources.length) {
    showError("No se pudo cargar ninguna textura del globo");
    return;
  }

  const textureLoader = new THREE.TextureLoader();
  textureLoader.load(
    sources[index],
    (texture) => {
      initScene(texture);
      loader.remove();
    },
    undefined,
    (error) => {
      console.warn(`Error con fuente ${sources[index]}:`, error);
      loadTextureWithFallbacks(sources, index + 1); // Intentar siguiente fuente
    }
  );
}

function initScene(earthTexture) {
  // Escena Three.js
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.z = 3;

  // Renderer con antialiasing
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(500, 500);
  document.getElementById('globe-container').appendChild(renderer.domElement);

  // Crear globo terrestre
  const globeGeometry = new THREE.SphereGeometry(1, 64, 64);
  const globeMaterial = new THREE.MeshPhongMaterial({
    map: earthTexture,
    shininess: 10,
    specular: new THREE.Color(0x111111),
    transparent: true,
    opacity: 1
  });
  
  globe = new THREE.Mesh(globeGeometry, globeMaterial);
  scene.add(globe);

  // Iluminación mejorada
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
  directionalLight.position.set(3, 2, 5);
  scene.add(directionalLight);

  // Controles de interacción
  setupControls();
  initFunctions();
  animate();
}

function setupControls() {
  let targetZoom = 3;
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };

  // Eventos de ratón corregidos
  renderer.domElement.addEventListener('mousedown', (e) => {
    isDragging = true;
    isRotating = false;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  renderer.domElement.addEventListener('mousemove', (e) => {
    if (isDragging && globe) {
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };

      globe.rotation.y -= deltaMove.x * 0.004;
      globe.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, globe.rotation.x - deltaMove.y * 0.004));
      previousMousePosition = { x: e.clientX, y: e.clientY };
    }
  });

  const endDrag = () => {
    isDragging = false;
    isRotating = true;
  };

  renderer.domElement.addEventListener('mouseup', endDrag);
  renderer.domElement.addEventListener('mouseleave', endDrag);

  // Zoom natural
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetZoom = Math.max(1.5, Math.min(10, targetZoom + e.deltaY * -0.01));
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

// [Resto de las funciones (createUserMarker, fetchUserLocation, etc.) se mantienen igual]
