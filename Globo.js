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
loader.textContent = 'Cargando globo...';
document.body.appendChild(loader);

// Textura ligera (1024x512px - 85% más ligera que la versión 2048x1024)
const textureLoader = new THREE.TextureLoader();
textureLoader.load(
  'https://threejs.org/examples/textures/planets/earth_atmos_1024.jpg',
  initScene,
  undefined,
  (error) => {
    loader.textContent = 'Error cargando el globo. Recargue la página.';
    loader.style.color = '#ff5555';
    console.error("Error cargando textura:", error);
  }
);

function initScene(earthTexture) {
  // Eliminar loader
  loader.remove();

  // Escena Three.js
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.z = 3;

  // Renderer optimizado
  const renderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(500, 500);
  document.getElementById('globe-container').appendChild(renderer.domElement);

  // Globo terrestre con textura ligera
  const globe = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 10,
      specular: new THREE.Color(0x111111),
      transparent: true,
      opacity: 1
    })
  );
  scene.add(globe);

  // Iluminación optimizada
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
  directionalLight.position.set(3, 2, 5);
  scene.add(directionalLight);

  // Variables de control
  let targetZoom = 3;
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };

  // Eventos de ratón CORREGIDOS
  function onMouseDown(e) {
    isDragging = true;
    isRotating = false;
    previousMousePosition = {
      x: e.clientX,
      y: e.clientY
    };
  }

  function onMouseMove(e) {
    if (isDragging) {
      const deltaMove = {
        x: e.clientX - previousMousePosition.x,
        y: e.clientY - previousMousePosition.y
      };

      // Movimiento natural (no invertido)
      globe.rotation.y -= deltaMove.x * 0.004;
      globe.rotation.x -= deltaMove.y * 0.004;

      // Limitar rotación vertical
      globe.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, globe.rotation.x));

      previousMousePosition = {
        x: e.clientX,
        y: e.clientY
      };
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

  // Zoom natural (rueda hacia arriba = acercar)
  renderer.domElement.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetZoom += e.deltaY * -0.01;
    targetZoom = Math.max(1.5, Math.min(10, targetZoom));
    isRotating = false;
  });

  // Botones de UI
  document.getElementById('toggleRotation').addEventListener('click', () => {
    isRotating = !isRotating;
    document.getElementById('toggleRotation').textContent = 
      isRotating ? '⏸️ Pausar Rotación' : '▶️ Reiniciar Rotación';
  });

  document.getElementById('toggleDarkMode').addEventListener('click', () => {
    darkMode = !darkMode;
    document.body.classList.toggle('dark-mode', darkMode);
    document.getElementById('toggleDarkMode').textContent = 
      darkMode ? '☀️ Modo Claro' : '🌙 Modo Oscuro';
    if (map) map.invalidateSize();
  });

  document.getElementById('toggleView').addEventListener('click', toggleView);

  function toggleView() {
    is3DView = !is3DView;
    document.getElementById('globe-container').style.opacity = is3DView ? '1' : '0';
    document.getElementById('map-container').style.opacity = is3DView ? '0' : '1';
    document.getElementById('globe-container').style.display = is3DView ? 'block' : 'none';
    document.getElementById('map-container').style.display = is3DView ? 'none' : 'block';
    if (!is3DView) init2DMap();
  }

  // Mapa 2D
  function init2DMap() {
    if (!map) {
      map = L.map('map-container', {
        zoomControl: false,
        attributionControl: false
      }).setView([userLat || 0, userLng || 0], 2);
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);
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
      }).addTo(map)
        .bindPopup(marker.labelText);
    });

    if (userLat !== 0 && userLng !== 0) {
      map.setView([userLat, userLng], 5);
    }
  }

  // Animación optimizada
  function animate() {
    requestAnimationFrame(animate);
    
    // Zoom suave
    camera.position.z += (targetZoom - camera.position.z) * 0.08;
    
    // Rotación automática
    if (isRotating && !isDragging) {
      globe.rotation.y += 0.003;
    }
    
    renderer.render(scene, camera);
    
    // Actualizar posición de marcadores
    updateMarkerPositions();
  }

  // Actualizar posición de marcadores en 3D
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

  // Crear marcador de usuario
  function createUserMarker(lat, lng, labelText, isCurrentUser = true) {
    // Eliminar marcadores anteriores si existen
    if (isCurrentUser) {
      userMarkers = userMarkers.filter(m => !m.isCurrentUser);
      scene.children = scene.children.filter(obj => !(obj.userData && obj.userData.isUserMarker));
      document.querySelectorAll('.user-marker, .label.green').forEach(el => el.remove());
    }

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

  // Convertir lat/lng a coordenadas 3D
  function latLngToVector3(lat, lng, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  // Mostrar errores
  function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'firebase-error';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
  }

  // Iniciar animación
  animate();

  // Obtener ubicación del usuario
  fetchUserLocation();
}

// Obtener ubicación del usuario
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

    // Crear marcador del usuario actual
    createUserMarker(userLat, userLng, userLocationName, true);
    
    // Configurar Firestore
    await setupFirestore();
    
  } catch (error) {
    console.error("Error de ubicación:", error);
    createUserMarker(0, 0, "Ubicación no disponible", true);
  }
}

// Configurar Firestore
async function setupFirestore() {
  try {
    // Guardar ubicación actual
    await db.collection('activeUsers').doc(userId).set({
      lat: userLat,
      lng: userLng,
      name: userLocationName,
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Escuchar cambios en otros usuarios
    db.collection('activeUsers')
      .where('lastUpdate', '>', new Date(Date.now() - 5 * 60 * 1000))
      .onSnapshot(snapshot => {
        // Limpiar marcadores antiguos (excepto el actual)
        userMarkers = userMarkers.filter(marker => {
          if (marker.isCurrentUser) return true;
          scene.remove(marker.marker3D);
          marker.label.remove();
          marker.marker2D.remove();
          return false;
        });

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
      });

    // Actualizar contador global
    await updateGlobalCounter();
  } catch (error) {
    showError("Error en Firestore: " + error.message);
  }
}

// Actualizar contador global
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

// Actualizar fecha/hora
function updateDateTimeDisplay() {
  const now = new Date();
  const timeString = now.toLocaleTimeString();
  const dateString = now.toLocaleDateString();
  document.getElementById("datario").textContent = 
    `Hora: ${timeString} - Fecha: ${dateString} - Visitantes: ${activeVisitors}`;
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  updateDateTimeDisplay();
  setInterval(updateDateTimeDisplay, 1000);
});
