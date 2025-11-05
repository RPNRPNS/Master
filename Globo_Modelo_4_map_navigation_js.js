// map-navigation.js - Sistema de navegación a Google Maps

class MapNavigation {
    constructor() {
        this.clickTimer = null;
        this.lastClickedElement = null;
        this.doubleClickDelay = 300;
        this.init();
    }

    init() {
        console.log('🗺️ Iniciando sistema de navegación...');
        this.waitForMarkers().then(() => {
            this.setupEventListeners();
            console.log('✅ Navegación lista. Haz doble clic en cualquier marcador.');
        }).catch(error => {
            console.error('❌ Error inicializando navegación:', error);
        });
    }

    waitForMarkers() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 20; // 10 segundos máximo
            
            const checkMarkers = () => {
                attempts++;
                
                if (window.userMarkers && Array.isArray(window.userMarkers) && window.userMarkers.length > 0) {
                    console.log(`✅ Se encontraron ${window.userMarkers.length} marcadores`);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('No se encontraron marcadores después de 10 segundos'));
                } else {
                    console.log('⏳ Esperando marcadores...', attempts);
                    setTimeout(checkMarkers, 500);
                }
            };
            
            checkMarkers();
        });
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            this.handleClick(e);
        });

        console.log('🎯 Event listeners configurados');
    }

    handleClick(e) {
        const clickedMarker = this.findClickedMarker(e.target);
        
        if (clickedMarker) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('🎯 Clic en:', clickedMarker.labelText);
            
            if (this.lastClickedElement === clickedMarker && this.clickTimer) {
                clearTimeout(this.clickTimer);
                this.clickTimer = null;
                this.lastClickedElement = null;
                this.openMarkerInMaps(clickedMarker);
            } else {
                this.lastClickedElement = clickedMarker;
                clearTimeout(this.clickTimer);
                
                this.clickTimer = setTimeout(() => {
                    this.clickTimer = null;
                    this.lastClickedElement = null;
                    this.showClickFeedback(clickedMarker);
                }, this.doubleClickDelay);
            }
        } else {
            this.resetClickState();
        }
    }

    findClickedMarker(element) {
        if (!window.userMarkers || !Array.isArray(window.userMarkers)) {
            return null;
        }

        for (const marker of window.userMarkers) {
            if (!marker || !marker.marker2D || !marker.label) continue;

            if (element === marker.marker2D || 
                element === marker.label ||
                (marker.marker2D.contains && marker.marker2D.contains(element)) ||
                (marker.label.contains && marker.label.contains(element))) {
                return marker;
            }
        }
        return null;
    }

    openMarkerInMaps(marker) {
        console.log('🔥 DOBLE CLIC - Abriendo Google Maps...', marker);

        if (this.isValidMarker(marker)) {
            const mapsUrl = this.createGoogleMapsUrl(marker.lat, marker.lng);
            this.openUrlInNewTab(mapsUrl);
            this.showSuccessFeedback(marker);
        } else {
            this.showError('Coordenadas inválidas en el marcador');
        }
    }

    isValidMarker(marker) {
        return marker && 
               marker.lat !== undefined && 
               marker.lng !== undefined &&
               !isNaN(parseFloat(marker.lat)) && 
               !isNaN(parseFloat(marker.lng)) &&
               Math.abs(marker.lat) <= 90 &&
               Math.abs(marker.lng) <= 180;
    }

    createGoogleMapsUrl(lat, lng) {
        const formattedLat = parseFloat(lat).toFixed(6);
        const formattedLng = parseFloat(lng).toFixed(6);
        return `https://www.google.com/maps?q=${formattedLat},${formattedLng}&z=15`;
    }

    openUrlInNewTab(url) {
        console.log('🌍 Abriendo URL:', url);
        window.open(url, '_blank', 'noopener,noreferrer');
    }

    showSuccessFeedback(marker) {
        if (marker.marker2D) {
            const originalTransform = marker.marker2D.style.transform;
            const originalFilter = marker.marker2D.style.filter;
            
            marker.marker2D.style.transform = 'translate(-50%, -50%) scale(2)';
            marker.marker2D.style.filter = 'brightness(2) drop-shadow(0 0 10px #00ff00)';
            marker.marker2D.style.transition = 'all 0.3s ease';
            
            setTimeout(() => {
                if (marker.marker2D) {
                    marker.marker2D.style.transform = originalTransform;
                    marker.marker2D.style.filter = originalFilter;
                }
            }, 300);
        }

        this.showMessage(`📍 Abriendo ${marker.labelText} en Google Maps`, 'success');
    }

    showClickFeedback(marker) {
        if (marker.marker2D) {
            const originalTransform = marker.marker2D.style.transform;
            marker.marker2D.style.transform = 'translate(-50%, -50%) scale(1.5)';
            marker.marker2D.style.transition = 'transform 0.2s ease';
            
            setTimeout(() => {
                if (marker.marker2D) {
                    marker.marker2D.style.transform = originalTransform;
                }
            }, 200);
        }
    }

    showMessage(message, type = 'info') {
        const messageDiv = document.createElement('div');
        const colors = {
            success: '#34A853',
            error: '#EA4335',
            info: '#4285F4'
        };
        
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type]};
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            animation: slideIn 0.3s ease;
        `;
        
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 3000);
    }

    showError(message) {
        this.showMessage(`❌ ${message}`, 'error');
    }

    resetClickState() {
        clearTimeout(this.clickTimer);
        this.clickTimer = null;
        this.lastClickedElement = null;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            window.mapNavigation = new MapNavigation();
        }, 1000);
    });
} else {
    setTimeout(() => {
        window.mapNavigation = new MapNavigation();
    }, 1000);
}

window.testNavigation = function() {
    if (window.userMarkers && window.userMarkers.length > 0) {
        const marker = window.userMarkers[0];
        console.log('🧪 TEST: Abriendo primer marcador:', marker);
        const mapsUrl = `https://www.google.com/maps?q=${marker.lat},${marker.lng}`;
        window.open(mapsUrl, '_blank');
        console.log('✅ TEST: URL abierta:', mapsUrl);
    } else {
        console.error('❌ TEST: No hay marcadores disponibles');
    }
};

console.log('💡 Para probar manualmente, ejecuta: testNavigation()');