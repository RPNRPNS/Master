// cursor-manager.js - Gestión de cursores

const cursorConfig = {
    useCustomCursors: false,
    customCursorPath: 'custom-cursors/',
    cursorSize: 32
};

function initializeCursors() {
    if (cursorConfig.useCustomCursors) {
        enableCustomCursors();
    } else {
        enableDefaultCursors();
    }
}

function enableCustomCursors() {
    document.body.classList.add('cursor-custom-default');
    
    const buttons = document.querySelectorAll('button, .control-btn, a');
    buttons.forEach(btn => {
        btn.classList.add('cursor-custom-pointer');
    });
    
    const globe = document.getElementById('globe-container');
    if (globe) {
        globe.classList.add('cursor-custom-grab');
    }
    
    console.log('Cursores personalizados activados');
}

function enableDefaultCursors() {
    document.body.classList.remove('cursor-custom-default');
    
    const elements = document.querySelectorAll('[class*="cursor-custom-"]');
    elements.forEach(el => {
        el.className = el.className.replace(/cursor-custom-\S+/g, '').trim();
    });
    
    console.log('Cursores normales activados');
}

function toggleCustomCursors(enable) {
    cursorConfig.useCustomCursors = enable;
    
    if (enable) {
        enableCustomCursors();
    } else {
        enableDefaultCursors();
    }
}

function setupCursorInteractions() {
    const globeContainer = document.getElementById('globe-container');
    
    if (globeContainer) {
        globeContainer.addEventListener('mousedown', () => {
            globeContainer.style.filter = 'brightness(1.1)';
        });
        
        globeContainer.addEventListener('mouseup', () => {
            globeContainer.style.filter = 'brightness(1)';
        });
    }
    
    document.body.classList.add('loading');
    setTimeout(() => {
        document.body.classList.remove('loading');
    }, 2000);
}

function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
        document.body.classList.add('loading');
    }
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
        document.body.classList.remove('loading');
    }
}

window.cursorManager = {
    enableCustom: () => toggleCustomCursors(true),
    disableCustom: () => toggleCustomCursors(false),
    setPath: (path) => cursorConfig.customCursorPath = path,
    isCustomEnabled: () => cursorConfig.useCustomCursors
};

document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        initializeCursors();
        setupCursorInteractions();
    }, 100);
});

window.addEventListener('load', function() {
    setTimeout(() => {
        hideLoadingScreen();
    }, 1500);
});