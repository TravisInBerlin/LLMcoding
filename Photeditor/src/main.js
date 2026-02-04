/**
 * Photeditor - Main Application Entry Point
 * A modern, AI-powered web-based photo editor
 */

import './style.css';
import { ImageEditor } from './core/ImageEditor.js';
import { HistoryManager } from './core/History.js';
import { Filters } from './utils/filters.js';
import { BackgroundRemover } from './ai/BackgroundRemover.js';

class Photeditor {
  constructor() {
    this.canvas = document.getElementById('mainCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.dropZone = document.getElementById('dropZone');
    this.fileInput = document.getElementById('fileInput');
    this.canvasContainer = document.getElementById('canvasContainer');

    this.originalImage = null;
    this.currentImage = null;
    this.zoom = 1;

    this.imageEditor = new ImageEditor(this.canvas);
    this.history = new HistoryManager();
    this.filters = new Filters();
    this.bgRemover = new BackgroundRemover();

    this.adjustments = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      highlights: 0,
      shadows: 0,
      temperature: 0,
      sharpness: 0
    };

    this.currentFilter = 'none';
    this.exportFormat = 'png';
    this.exportQuality = 90;

    // Overlay elements (text, shapes)
    this.overlays = [];
    this.selectedOverlay = null;

    // Text settings
    this.textSettings = {
      text: '',
      fontSize: 48,
      color: '#ffffff',
      bold: false,
      italic: false,
      outline: false
    };

    // Shape settings
    this.shapeSettings = {
      type: 'rectangle',
      strokeWidth: 8,
      strokeColor: '#ff4444',
      fill: false,
      fillColor: '#ff444466'
    };

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupDragAndDrop();
    this.setupAdjustmentSliders();
    this.setupFilters();
    this.setupTabs();
    this.setupExportModal();
    this.setupCropModal();
    this.setupThemeToggle();
    this.setupKeyboardShortcuts();
    this.setupTextModal();
    this.setupShapeModal();
  }

  // ==========================================
  // Event Listeners Setup
  // ==========================================

  setupEventListeners() {
    // File input
    this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    this.dropZone.addEventListener('click', () => this.fileInput.click());

    // Toolbar buttons
    document.getElementById('undoBtn').addEventListener('click', () => this.undo());
    document.getElementById('redoBtn').addEventListener('click', () => this.redo());
    document.getElementById('resetBtn').addEventListener('click', () => this.resetImage());
    document.getElementById('exportBtn').addEventListener('click', () => this.showExportModal());

    // Transform tools
    document.getElementById('cropBtn').addEventListener('click', () => this.showCropModal());
    document.getElementById('rotateLeftBtn').addEventListener('click', () => this.rotate(-90));
    document.getElementById('rotateRightBtn').addEventListener('click', () => this.rotate(90));
    document.getElementById('flipHBtn').addEventListener('click', () => this.flip('horizontal'));
    document.getElementById('flipVBtn').addEventListener('click', () => this.flip('vertical'));

    // AI tools
    document.getElementById('removeBgBtn').addEventListener('click', () => this.removeBackground());
    document.getElementById('autoEnhanceBtn').addEventListener('click', () => this.autoEnhance());

    // Overlay tools
    document.getElementById('addTextBtn').addEventListener('click', () => this.showTextModal());
    document.getElementById('addShapeBtn').addEventListener('click', () => this.showShapeModal('rectangle'));
    document.getElementById('addCircleBtn').addEventListener('click', () => this.showShapeModal('circle'));
    document.getElementById('addArrowBtn').addEventListener('click', () => this.showShapeModal('arrow'));

    // Zoom controls
    document.getElementById('zoomInBtn').addEventListener('click', () => this.setZoom(this.zoom + 0.25));
    document.getElementById('zoomOutBtn').addEventListener('click', () => this.setZoom(this.zoom - 0.25));
    document.getElementById('zoomFitBtn').addEventListener('click', () => this.fitToScreen());

    // Mouse wheel zoom
    this.canvasContainer.addEventListener('wheel', (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.setZoom(this.zoom + delta);
      }
    }, { passive: false });
  }

  setupDragAndDrop() {
    const container = document.getElementById('canvasContainer');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      container.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      container.addEventListener(eventName, () => {
        this.dropZone.classList.add('drag-over');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      container.addEventListener(eventName, () => {
        this.dropZone.classList.remove('drag-over');
      });
    });

    container.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.loadImage(files[0]);
      }
    });

    // Paste from clipboard
    document.addEventListener('paste', (e) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const blob = item.getAsFile();
          this.loadImage(blob);
          break;
        }
      }
    });
  }

  setupAdjustmentSliders() {
    const adjustmentNames = ['brightness', 'contrast', 'saturation', 'exposure', 'highlights', 'shadows', 'temperature', 'sharpness'];

    adjustmentNames.forEach(name => {
      const slider = document.getElementById(name);
      const valueDisplay = document.getElementById(`${name}Value`);

      slider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        this.adjustments[name] = value;
        valueDisplay.textContent = value;
        this.applyAdjustments();
      });
    });
  }

  setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentFilter = btn.dataset.filter;
        this.applyAdjustments();
      });
    });
  }

  setupTabs() {
    const tabs = document.querySelectorAll('.panel-tab');
    const panels = document.querySelectorAll('.panel-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(`${tab.dataset.tab}Panel`).classList.add('active');
      });
    });
  }

  setupExportModal() {
    const modal = document.getElementById('exportModal');
    const formatButtons = document.querySelectorAll('.format-btn');
    const qualityOption = document.querySelector('.quality-option');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValue = document.getElementById('qualityValue');

    formatButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        formatButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.exportFormat = btn.dataset.format;

        // Show quality slider for lossy formats
        if (this.exportFormat === 'jpeg' || this.exportFormat === 'webp') {
          qualityOption.classList.add('visible');
        } else {
          qualityOption.classList.remove('visible');
        }
      });
    });

    qualitySlider.addEventListener('input', (e) => {
      this.exportQuality = parseInt(e.target.value);
      qualityValue.textContent = this.exportQuality;
    });

    document.getElementById('cancelExport').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('confirmExport').addEventListener('click', () => {
      this.exportImage();
      modal.classList.add('hidden');
    });

    modal.querySelector('.modal-backdrop').addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  setupCropModal() {
    const modal = document.getElementById('cropModal');
    const presetButtons = document.querySelectorAll('.preset-btn');

    presetButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        presetButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.cropAspectRatio = btn.dataset.aspect;
        this.updateCropSelection();
      });
    });

    document.getElementById('cancelCrop').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('applyCrop').addEventListener('click', () => {
      this.applyCrop();
      modal.classList.add('hidden');
    });

    modal.querySelector('.modal-backdrop').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    // Initialize crop selection dragging
    this.initCropInteraction();
  }

  setupTextModal() {
    const modal = document.getElementById('textModal');
    const fontSizeSlider = document.getElementById('fontSizeSlider');
    const fontSizeValue = document.getElementById('fontSizeValue');
    const textColor = document.getElementById('textColor');
    const colorPresets = document.querySelectorAll('.color-preset');
    const boldBtn = document.getElementById('boldBtn');
    const italicBtn = document.getElementById('italicBtn');
    const outlineBtn = document.getElementById('outlineBtn');

    fontSizeSlider.addEventListener('input', (e) => {
      this.textSettings.fontSize = parseInt(e.target.value);
      fontSizeValue.textContent = this.textSettings.fontSize;
    });

    textColor.addEventListener('input', (e) => {
      this.textSettings.color = e.target.value;
    });

    colorPresets.forEach(preset => {
      preset.addEventListener('click', () => {
        this.textSettings.color = preset.dataset.color;
        textColor.value = preset.dataset.color;
      });
    });

    boldBtn.addEventListener('click', () => {
      this.textSettings.bold = !this.textSettings.bold;
      boldBtn.classList.toggle('active', this.textSettings.bold);
    });

    italicBtn.addEventListener('click', () => {
      this.textSettings.italic = !this.textSettings.italic;
      italicBtn.classList.toggle('active', this.textSettings.italic);
    });

    outlineBtn.addEventListener('click', () => {
      this.textSettings.outline = !this.textSettings.outline;
      outlineBtn.classList.toggle('active', this.textSettings.outline);
    });

    document.getElementById('cancelText').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('confirmText').addEventListener('click', () => {
      this.addTextOverlay();
      modal.classList.add('hidden');
    });

    modal.querySelector('.modal-backdrop').addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  setupShapeModal() {
    const modal = document.getElementById('shapeModal');
    const shapeTypeBtns = document.querySelectorAll('.shape-type-btn');
    const strokeWidthSlider = document.getElementById('strokeWidthSlider');
    const strokeWidthValue = document.getElementById('strokeWidthValue');
    const strokeColor = document.getElementById('strokeColor');
    const shapeFill = document.getElementById('shapeFill');
    const fillColor = document.getElementById('fillColor');

    shapeTypeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        shapeTypeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.shapeSettings.type = btn.dataset.shape;
      });
    });

    strokeWidthSlider.addEventListener('input', (e) => {
      this.shapeSettings.strokeWidth = parseInt(e.target.value);
      strokeWidthValue.textContent = this.shapeSettings.strokeWidth;
    });

    strokeColor.addEventListener('input', (e) => {
      this.shapeSettings.strokeColor = e.target.value;
    });

    shapeFill.addEventListener('change', (e) => {
      this.shapeSettings.fill = e.target.checked;
    });

    fillColor.addEventListener('input', (e) => {
      this.shapeSettings.fillColor = e.target.value;
    });

    document.getElementById('cancelShape').addEventListener('click', () => {
      modal.classList.add('hidden');
    });

    document.getElementById('confirmShape').addEventListener('click', () => {
      this.addShapeOverlay();
      modal.classList.add('hidden');
    });

    modal.querySelector('.modal-backdrop').addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  setupThemeToggle() {
    const toggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('photeditor-theme') || 'dark';

    if (savedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    }

    toggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('photeditor-theme', next);
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              this.redo();
            } else {
              this.undo();
            }
            break;
          case 'y':
            e.preventDefault();
            this.redo();
            break;
          case 's':
            e.preventDefault();
            this.showExportModal();
            break;
          case 'o':
            e.preventDefault();
            this.fileInput.click();
            break;
          case 't':
            e.preventDefault();
            this.showTextModal();
            break;
        }
      }

      // Delete selected overlay
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedOverlay && !e.target.matches('input, textarea')) {
          e.preventDefault();
          this.deleteSelectedOverlay();
        }
      }
    });
  }

  // ==========================================
  // Image Loading
  // ==========================================

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.loadImage(file);
    }
  }

  loadImage(file) {
    if (!file.type.match('image.*')) {
      alert('Please select an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.originalImage = img;
        this.currentImage = this.imageEditor.imageToCanvas(img);
        this.overlays = []; // Clear overlays when new image is loaded
        this.resetAdjustments();
        this.displayImage();
        this.enableControls();
        this.saveToHistory();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  displayImage() {
    if (!this.currentImage) return;

    this.dropZone.classList.add('hidden');
    this.canvas.classList.remove('hidden');

    // Apply current adjustments and display
    const processed = this.imageEditor.applyAdjustments(
      this.currentImage,
      this.adjustments,
      this.currentFilter
    );

    this.canvas.width = processed.width;
    this.canvas.height = processed.height;
    this.ctx.drawImage(processed, 0, 0);

    // Draw overlays on canvas
    this.drawOverlays();

    // Fit to screen on first load, or maintain current zoom
    if (this.zoom === 1) {
      this.fitToScreen();
    } else {
      this.setZoom(this.zoom);
    }
  }

  enableControls() {
    document.getElementById('undoBtn').disabled = false;
    document.getElementById('redoBtn').disabled = false;
    document.getElementById('resetBtn').disabled = false;
    document.getElementById('exportBtn').disabled = false;
    this.updateHistoryButtons();
  }

  // ==========================================
  // Image Adjustments
  // ==========================================

  applyAdjustments() {
    if (!this.currentImage) return;

    const processed = this.imageEditor.applyAdjustments(
      this.currentImage,
      this.adjustments,
      this.currentFilter
    );

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(processed, 0, 0);

    // Redraw overlays
    this.drawOverlays();
  }

  resetAdjustments() {
    this.adjustments = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      exposure: 0,
      highlights: 0,
      shadows: 0,
      temperature: 0,
      sharpness: 0
    };

    // Reset sliders
    Object.keys(this.adjustments).forEach(key => {
      const slider = document.getElementById(key);
      const valueDisplay = document.getElementById(`${key}Value`);
      if (slider && valueDisplay) {
        slider.value = this.adjustments[key];
        valueDisplay.textContent = this.adjustments[key];
      }
    });

    // Reset filter
    this.currentFilter = 'none';
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === 'none');
    });
  }

  // ==========================================
  // Transform Operations
  // ==========================================

  rotate(degrees) {
    if (!this.currentImage) return;

    this.currentImage = this.imageEditor.rotate(this.currentImage, degrees);
    this.displayImage();
    this.saveToHistory();
  }

  flip(direction) {
    if (!this.currentImage) return;

    this.currentImage = this.imageEditor.flip(this.currentImage, direction);
    this.displayImage();
    this.saveToHistory();
  }

  // ==========================================
  // Crop
  // ==========================================

  showCropModal() {
    if (!this.currentImage) return;

    const modal = document.getElementById('cropModal');
    const cropCanvas = document.getElementById('cropCanvas');
    const ctx = cropCanvas.getContext('2d');

    // Scale image to fit in modal
    const maxWidth = 560;
    const maxHeight = 380;
    const scale = Math.min(maxWidth / this.currentImage.width, maxHeight / this.currentImage.height);

    cropCanvas.width = this.currentImage.width * scale;
    cropCanvas.height = this.currentImage.height * scale;
    ctx.drawImage(this.currentImage, 0, 0, cropCanvas.width, cropCanvas.height);

    this.cropScale = scale;
    this.cropAspectRatio = 'free';

    // Initialize selection to full image
    const selection = document.getElementById('cropSelection');
    selection.style.left = '10%';
    selection.style.top = '10%';
    selection.style.width = '80%';
    selection.style.height = '80%';

    modal.classList.remove('hidden');
  }

  initCropInteraction() {
    const selection = document.getElementById('cropSelection');
    const container = document.getElementById('cropContainer');
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startLeft, startTop, startWidth, startHeight;
    let resizeHandle = null;

    selection.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('crop-handle')) {
        isResizing = true;
        resizeHandle = e.target.classList[1]; // nw, ne, sw, se
      } else {
        isDragging = true;
      }

      startX = e.clientX;
      startY = e.clientY;
      startLeft = selection.offsetLeft;
      startTop = selection.offsetTop;
      startWidth = selection.offsetWidth;
      startHeight = selection.offsetHeight;

      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging && !isResizing) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const containerRect = container.getBoundingClientRect();

      if (isDragging) {
        let newLeft = startLeft + dx;
        let newTop = startTop + dy;

        // Constrain to container
        newLeft = Math.max(0, Math.min(newLeft, containerRect.width - startWidth));
        newTop = Math.max(0, Math.min(newTop, containerRect.height - startHeight));

        selection.style.left = newLeft + 'px';
        selection.style.top = newTop + 'px';
      }

      if (isResizing) {
        let newLeft = startLeft;
        let newTop = startTop;
        let newWidth = startWidth;
        let newHeight = startHeight;

        if (resizeHandle.includes('e')) {
          newWidth = Math.max(50, startWidth + dx);
        }
        if (resizeHandle.includes('w')) {
          newWidth = Math.max(50, startWidth - dx);
          newLeft = startLeft + dx;
        }
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(50, startHeight + dy);
        }
        if (resizeHandle.includes('n')) {
          newHeight = Math.max(50, startHeight - dy);
          newTop = startTop + dy;
        }

        // Constrain to container
        newLeft = Math.max(0, newLeft);
        newTop = Math.max(0, newTop);
        newWidth = Math.min(newWidth, containerRect.width - newLeft);
        newHeight = Math.min(newHeight, containerRect.height - newTop);

        selection.style.left = newLeft + 'px';
        selection.style.top = newTop + 'px';
        selection.style.width = newWidth + 'px';
        selection.style.height = newHeight + 'px';
      }
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      isResizing = false;
      resizeHandle = null;
    });
  }

  updateCropSelection() {
    // Update selection based on aspect ratio
    const selection = document.getElementById('cropSelection');
    const container = document.getElementById('cropContainer');
    const containerRect = container.getBoundingClientRect();

    if (this.cropAspectRatio === 'free') return;

    const [w, h] = this.cropAspectRatio.split(':').map(Number);
    const ratio = w / h;

    let width = containerRect.width * 0.8;
    let height = width / ratio;

    if (height > containerRect.height * 0.8) {
      height = containerRect.height * 0.8;
      width = height * ratio;
    }

    selection.style.width = width + 'px';
    selection.style.height = height + 'px';
    selection.style.left = (containerRect.width - width) / 2 + 'px';
    selection.style.top = (containerRect.height - height) / 2 + 'px';
  }

  applyCrop() {
    const selection = document.getElementById('cropSelection');
    const cropCanvas = document.getElementById('cropCanvas');

    // Get selection bounds relative to the scaled canvas
    const x = selection.offsetLeft / this.cropScale;
    const y = selection.offsetTop / this.cropScale;
    const width = selection.offsetWidth / this.cropScale;
    const height = selection.offsetHeight / this.cropScale;

    this.currentImage = this.imageEditor.crop(this.currentImage, x, y, width, height);
    this.displayImage();
    this.saveToHistory();
  }

  // ==========================================
  // Text & Shape Overlays
  // ==========================================

  showTextModal() {
    if (!this.currentImage) {
      alert('Please load an image first.');
      return;
    }

    const modal = document.getElementById('textModal');
    document.getElementById('textInput').value = '';
    document.getElementById('textInput').focus();
    modal.classList.remove('hidden');
  }

  showShapeModal(type = 'rectangle') {
    if (!this.currentImage) {
      alert('Please load an image first.');
      return;
    }

    this.shapeSettings.type = type;

    // Update active button
    document.querySelectorAll('.shape-type-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.shape === type);
    });

    const modal = document.getElementById('shapeModal');
    modal.classList.remove('hidden');
  }

  addTextOverlay() {
    const text = document.getElementById('textInput').value.trim();
    if (!text) return;

    const overlay = {
      type: 'text',
      text: text,
      x: this.currentImage.width / 2,
      y: this.currentImage.height / 2,
      fontSize: this.textSettings.fontSize,
      color: this.textSettings.color,
      bold: this.textSettings.bold,
      italic: this.textSettings.italic,
      outline: this.textSettings.outline
    };

    this.overlays.push(overlay);
    this.applyAdjustments();
    this.saveToHistory();
  }

  addShapeOverlay() {
    // Scale stroke width based on image size (minimum 8px, scale up for larger images)
    const imageScale = Math.max(this.currentImage.width, this.currentImage.height) / 1000;
    const scaledStrokeWidth = Math.max(this.shapeSettings.strokeWidth, Math.round(this.shapeSettings.strokeWidth * imageScale));

    const overlay = {
      type: 'shape',
      shapeType: this.shapeSettings.type,
      x: this.currentImage.width / 4,
      y: this.currentImage.height / 4,
      width: this.currentImage.width / 2,
      height: this.currentImage.height / 2,
      strokeWidth: scaledStrokeWidth,
      strokeColor: this.shapeSettings.strokeColor,
      fill: this.shapeSettings.fill,
      fillColor: this.shapeSettings.fillColor
    };

    this.overlays.push(overlay);
    this.applyAdjustments();
    this.saveToHistory();
  }

  drawOverlays() {
    this.overlays.forEach(overlay => {
      if (overlay.type === 'text') {
        this.drawTextOverlay(overlay);
      } else if (overlay.type === 'shape') {
        this.drawShapeOverlay(overlay);
      }
    });
  }

  drawTextOverlay(overlay) {
    this.ctx.save();

    let fontStyle = '';
    if (overlay.italic) fontStyle += 'italic ';
    if (overlay.bold) fontStyle += 'bold ';

    this.ctx.font = `${fontStyle}${overlay.fontSize}px Inter, sans-serif`;
    this.ctx.fillStyle = overlay.color;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    if (overlay.outline) {
      this.ctx.strokeStyle = overlay.color;
      this.ctx.lineWidth = 2;
      this.ctx.strokeText(overlay.text, overlay.x, overlay.y);
    }

    // Add shadow for better visibility
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;

    this.ctx.fillText(overlay.text, overlay.x, overlay.y);

    this.ctx.restore();
  }

  drawShapeOverlay(overlay) {
    this.ctx.save();

    this.ctx.strokeStyle = overlay.strokeColor;
    this.ctx.lineWidth = overlay.strokeWidth;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (overlay.fill) {
      this.ctx.fillStyle = overlay.fillColor;
    }

    switch (overlay.shapeType) {
      case 'rectangle':
        if (overlay.fill) {
          this.ctx.fillRect(overlay.x, overlay.y, overlay.width, overlay.height);
        }
        this.ctx.strokeRect(overlay.x, overlay.y, overlay.width, overlay.height);
        break;

      case 'circle':
        this.ctx.beginPath();
        const radiusX = overlay.width / 2;
        const radiusY = overlay.height / 2;
        const centerX = overlay.x + radiusX;
        const centerY = overlay.y + radiusY;
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        if (overlay.fill) {
          this.ctx.fill();
        }
        this.ctx.stroke();
        break;

      case 'arrow':
        const startX = overlay.x;
        const startY = overlay.y + overlay.height / 2;
        const endX = overlay.x + overlay.width;
        const endY = overlay.y + overlay.height / 2;
        const headLength = 20;
        const angle = Math.atan2(endY - startY, endX - startX);

        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
        this.ctx.stroke();
        break;

      case 'line':
        this.ctx.beginPath();
        this.ctx.moveTo(overlay.x, overlay.y);
        this.ctx.lineTo(overlay.x + overlay.width, overlay.y + overlay.height);
        this.ctx.stroke();
        break;
    }

    this.ctx.restore();
  }

  deleteSelectedOverlay() {
    if (this.selectedOverlay !== null) {
      this.overlays.splice(this.selectedOverlay, 1);
      this.selectedOverlay = null;
      this.applyAdjustments();
      this.saveToHistory();
    }
  }

  // ==========================================
  // AI Features
  // ==========================================

  async removeBackground() {
    if (!this.currentImage) return;

    this.showLoading('Removing background with AI...');

    try {
      // Convert current canvas to blob
      const blob = await new Promise(resolve => {
        this.currentImage.toBlob(resolve, 'image/png');
      });

      const result = await this.bgRemover.remove(blob);

      // Load result as image
      const img = new Image();
      img.onload = () => {
        this.currentImage = this.imageEditor.imageToCanvas(img);
        this.displayImage();
        this.saveToHistory();
        this.hideLoading();
      };
      img.src = URL.createObjectURL(result);
    } catch (error) {
      console.error('Background removal failed:', error);
      this.hideLoading();
      alert('Background removal failed. Please try again.');
    }
  }

  autoEnhance() {
    if (!this.currentImage) return;

    this.showLoading('Enhancing image...');

    setTimeout(() => {
      // Apply auto enhancement adjustments
      this.adjustments = {
        brightness: 5,
        contrast: 10,
        saturation: 15,
        exposure: 5,
        highlights: -10,
        shadows: 10,
        temperature: 0,
        sharpness: 20
      };

      // Update sliders
      Object.keys(this.adjustments).forEach(key => {
        const slider = document.getElementById(key);
        const valueDisplay = document.getElementById(`${key}Value`);
        if (slider && valueDisplay) {
          slider.value = this.adjustments[key];
          valueDisplay.textContent = this.adjustments[key];
        }
      });

      this.applyAdjustments();
      this.hideLoading();
    }, 500);
  }

  // ==========================================
  // History (Undo/Redo)
  // ==========================================

  saveToHistory() {
    const imageData = this.currentImage.toDataURL('image/png');
    this.history.push({
      imageData,
      adjustments: { ...this.adjustments },
      filter: this.currentFilter,
      overlays: JSON.parse(JSON.stringify(this.overlays))
    });
    this.updateHistoryButtons();
  }

  undo() {
    const state = this.history.undo();
    if (state) {
      this.restoreState(state);
    }
  }

  redo() {
    const state = this.history.redo();
    if (state) {
      this.restoreState(state);
    }
  }

  restoreState(state) {
    const img = new Image();
    img.onload = () => {
      this.currentImage = this.imageEditor.imageToCanvas(img);
      this.adjustments = { ...state.adjustments };
      this.currentFilter = state.filter;
      this.overlays = state.overlays ? JSON.parse(JSON.stringify(state.overlays)) : [];

      // Update UI
      Object.keys(this.adjustments).forEach(key => {
        const slider = document.getElementById(key);
        const valueDisplay = document.getElementById(`${key}Value`);
        if (slider && valueDisplay) {
          slider.value = this.adjustments[key];
          valueDisplay.textContent = this.adjustments[key];
        }
      });

      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === this.currentFilter);
      });

      this.displayImage();
      this.updateHistoryButtons();
    };
    img.src = state.imageData;
  }

  updateHistoryButtons() {
    document.getElementById('undoBtn').disabled = !this.history.canUndo();
    document.getElementById('redoBtn').disabled = !this.history.canRedo();
  }

  resetImage() {
    if (!this.originalImage) return;

    this.currentImage = this.imageEditor.imageToCanvas(this.originalImage);
    this.overlays = [];
    this.resetAdjustments();
    this.displayImage();
    this.saveToHistory();
  }

  // ==========================================
  // Zoom
  // ==========================================

  setZoom(level) {
    this.zoom = Math.max(0.1, Math.min(5, level));
    this.canvas.style.transform = `scale(${this.zoom})`;
    this.canvas.style.transformOrigin = 'center center';
    document.getElementById('zoomLevel').textContent = Math.round(this.zoom * 100) + '%';
  }

  fitToScreen() {
    if (!this.canvas.width) return;

    const container = document.getElementById('canvasContainer');
    const padding = 60;
    const maxWidth = container.clientWidth - padding * 2;
    const maxHeight = container.clientHeight - padding * 2;

    const scaleX = maxWidth / this.canvas.width;
    const scaleY = maxHeight / this.canvas.height;

    // Allow zoom > 1 for smaller images to fill more space, but cap at 2x
    const scale = Math.min(scaleX, scaleY, 2);

    this.setZoom(scale);
  }

  // ==========================================
  // Export
  // ==========================================

  showExportModal() {
    if (!this.currentImage) return;
    document.getElementById('exportModal').classList.remove('hidden');
  }

  exportImage() {
    // Create a new canvas with overlays baked in
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = this.currentImage.width;
    exportCanvas.height = this.currentImage.height;
    const exportCtx = exportCanvas.getContext('2d');

    // Draw processed image
    const processed = this.imageEditor.applyAdjustments(
      this.currentImage,
      this.adjustments,
      this.currentFilter
    );
    exportCtx.drawImage(processed, 0, 0);

    // Draw overlays
    const originalCtx = this.ctx;
    this.ctx = exportCtx;
    this.drawOverlays();
    this.ctx = originalCtx;

    let mimeType, extension;
    switch (this.exportFormat) {
      case 'jpeg':
        mimeType = 'image/jpeg';
        extension = 'jpg';
        break;
      case 'webp':
        mimeType = 'image/webp';
        extension = 'webp';
        break;
      default:
        mimeType = 'image/png';
        extension = 'png';
    }

    const quality = this.exportFormat === 'png' ? 1 : this.exportQuality / 100;
    const dataURL = exportCanvas.toDataURL(mimeType, quality);

    const link = document.createElement('a');
    link.download = `photeditor-export.${extension}`;
    link.href = dataURL;
    link.click();
  }

  // ==========================================
  // Loading Overlay
  // ==========================================

  showLoading(text = 'Processing...') {
    document.getElementById('loadingText').textContent = text;
    document.getElementById('loadingOverlay').classList.remove('hidden');
  }

  hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  window.photeditor = new Photeditor();
});
