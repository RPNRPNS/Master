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

// Mostrar loader mejorado
const loader = document.createElement('div');
loader.className = 'loader';
loader.innerHTML = `
  <div class="loader-content">
    <div class="loader-spinner"></div>
    <div class="loader-text">Cargando textura HD del globo...</div>
    <div class="loader-subtext">(Esta textura es de alta calidad y puede tardar en cargar)</div>
  </div>
`;
document.body.appendChild(loader);

// Textura HD original (2048x1024)
const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
  (texture) => {
    initScene(texture);
    loader.remove();
  },
  (xhr) => {
    // Mostrar progreso de carga
    const progress = (xhr.loaded / xhr.total * 100).toFixed(0);
    const progressText = loader.querySelector('.loader-text');
    if (progressText) {
      progressText.textContent = `Cargando textura HD: ${progress}%`;
    }
  },
  (error) => {
    showError("Error cargando la textura HD. Recargue la página.");
    console.error("Error cargando textura:", error);
    // Intentar cargar versión ligera como respaldo
    loadFallbackTexture();
  }
);

function loadFallbackTexture() {
  loader.querySelector('.loader-text').textContent = "Cargando versión ligera...";
  textureLoader.load(
    'https://threejs.org/examples/textures/planets/earth_atmos_1024.jpg',
    (texture) => {
      initScene(texture);
      loader.remove();
    },
    undefined,
    (error) => {
      showError("No se pudo cargar ninguna textura del globo");
      console.error("Error cargando textura de respaldo:", error);
    }
  );
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

  // Crear globo terrestre con textura HD
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

  // Iluminación mejorada
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 3, 5);
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
