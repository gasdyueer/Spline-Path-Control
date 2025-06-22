// ================
// GLOBAL VARIABLES
// ================
let splines = [];
let staticShapes = [];
let draggedPoint = null;
let draggedStaticShape = null;
let draggedSpline = null; 
let dragStartPos = null; 
let backgroundImg = null;
let selectedSpline = null;
let selectedStaticShape = null;
let selectedPoint = null;
let selectedPointIndex = -1;
let selectedSplineIndex = -1;
let isExporting = false;
let exportProgress = 0;
let exportTotalFrames = 0;
let exportFPS = 0;
let exportDuration = 0;
let exportCanvas;
let mediaRecorder;
let recordedChunks = [];
let exportStream = null;
let originalImageDimensions = { width: 1000, height: 562 }; 
let canvas;
let appStartTime;
let loopingPreview = true; 
let loopPreviewButton; 
let themeToggleButton;
let exportOverlay, progressBarFill, exportPercentage, exportFrameCount;

// Timeline variables
let timelinePlayhead;
let currentFrame = 0;
let totalFramesDisplay;
let zoomSlider;
let framesPerPixel = 1; // How many frames each pixel represents on the timeline
let timelineWidth = 0; // Dynamic width of the tracks-area
let timelineTracksContainer;
let trackHeadersContainer;
let tracksArea;
let timelinePlayButton, timelineStopButton, currentFrameInput;
let isPlayingTimeline = false;
let lastFrameTime = 0;
let frameRate = 30; // Default timeline frame rate

// Undo/Redo variables
let history = [];
let historyIndex = -1;
let dragOccurred = false;

// Multi-selection variables
let multiSelection = [];
let selectionBox = null;
let isDraggingSelection = false;

// New variables for spline colors
const splineColors = [
  '#4CAF50', // Green
  '#F44336', // Red
  '#FF9800', // Orange
  '#2196F3', // Blue
  '#9C27B0', // Purple
  '#FFEB3B', // Yellow
  '#009688', // Teal
  '#E91E63', // Pink
  '#3F51B5', // Indigo
  '#B71C1C', // Dark Red
  '#E65100', // Dark Orange
  '#0D47A1', // Dark Blue
  '#4A148C', // Dark Purple
  '#F57F17'  // Dark Yellow/Amber
];
let splineColorIndex = 0;


// New variables for playback control
let isPlayingOnce = false;
const METADATA_MARKER = "SPLINEDATA::";

// =========
// SETUP
// =========
function setup() {
  canvas = createCanvas(1000, 562); 
  canvas.parent('canvas-container');
  pixelDensity(1);
  appStartTime = millis();
  canvas.drop(gotFile);
  exportOverlay = document.getElementById('export-overlay');
  progressBarFill = document.getElementById('progress-bar-fill');
  exportPercentage = document.getElementById('export-percentage');
  exportFrameCount = document.getElementById('export-frame-count');

  // Timeline element references
  timelinePlayButton = document.getElementById('timelinePlay');
  timelineStopButton = document.getElementById('timelineStop');
  currentFrameInput = document.getElementById('currentFrame');
  totalFramesDisplay = document.getElementById('totalFramesDisplay');
  zoomSlider = document.getElementById('zoomSlider');
  timelineTracksContainer = document.querySelector('.timeline-tracks-container');
  trackHeadersContainer = document.querySelector('.track-headers');
  tracksArea = document.querySelector('.tracks-area');
  timelinePlayhead = document.createElement('div');
  timelinePlayhead.className = 'timeline-playhead';
  tracksArea.appendChild(timelinePlayhead);

  // Initial timeline setup
  updateTimelineWidth();
  updateTimelineRuler();
  updateTotalFramesDisplay();
  const savedTheme = localStorage.getItem('splineEditorTheme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
  }
  setupEventListeners();
  addNewSpline(); // This will also create the first history state
}

function setupEventListeners() {
  document.getElementById('deleteSpline').addEventListener('click', deleteSelectedSpline);
  document.getElementById('exportVideo').addEventListener('click', startExport);
  document.getElementById('cancelExport').addEventListener('click', cancelExport);
  document.getElementById('removePoint').addEventListener('click', removeSelectedItem);
  document.getElementById('newSpline').addEventListener('click', addNewSpline);
  document.getElementById('clearAll').addEventListener('click', clearAll);
  document.getElementById('clearBg').addEventListener('click', () => { backgroundImg = null; document.getElementById('bgImage').value = ''; recordState(); });
  document.getElementById('bgImage').addEventListener('change', handleSceneFile);
  document.getElementById('addPoint').addEventListener('click', addPointToSpline);
  document.getElementById('addShape').addEventListener('click', addStaticShape);
  document.getElementById('updateCanvasSize').addEventListener('click', updateCanvasSize);
  document.getElementById('resetCanvasSize').addEventListener('click', resetCanvasSize);
  document.getElementById('cloneItem').addEventListener('click', cloneSelectedItem);
  document.getElementById('playOnce').addEventListener('click', playOnce);
  loopPreviewButton = document.getElementById('loopPreview');
  loopPreviewButton.addEventListener('click', toggleLooping);
  themeToggleButton = document.getElementById('themeToggle');
  themeToggleButton.addEventListener('click', toggleTheme);
  
  // Undo/Redo button listeners
  document.getElementById('undoBtn').addEventListener('click', undo);
  document.getElementById('redoBtn').addEventListener('click', redo);
  
  // New listeners for canvas save/load
  document.getElementById('exportCanvas').addEventListener('click', exportScene);
  document.getElementById('loadCanvasBtn').addEventListener('click', () => document.getElementById('loadCanvas').click());
  document.getElementById('loadCanvas').addEventListener('change', handleSceneFile);

  if (document.body.classList.contains('dark-mode')) {
    themeToggleButton.textContent = 'Switch to Light Mode';
  } else {
    themeToggleButton.textContent = 'Switch to Dark Mode';
  }
  
  // Listen for changes on all control inputs for history
  const controls = ['StartFrame', 'TotalFrames', 'Type', 'FillColor', 'StrokeColor', 'StrokeWeight', 'Tension', 'Easing'];
  controls.forEach(control => {
    const element = document.getElementById(`selected${control}`);
    element.addEventListener('input', updateSelectedItem); // Live update
    element.addEventListener('change', recordState);      // Save history on final change
  });
  document.getElementById('selectedSizeX').addEventListener('input', updateSelectedItem);
  document.getElementById('selectedSizeY').addEventListener('input', updateSelectedItem);
  document.getElementById('selectedSizeX').addEventListener('change', recordState);
  document.getElementById('selectedSizeY').addEventListener('change', recordState);

  // Global setting listeners for history
  document.getElementById('exportFPS').addEventListener('change', recordState);
  document.getElementById('exportTotalFrames').addEventListener('change', () => {
    recordState();
    updateTotalFramesDisplay();
  });


  const canvasContainer = document.getElementById('canvas-container');
  canvasContainer.addEventListener('dragover', (e) => { e.preventDefault(); e.stopPropagation(); canvasContainer.classList.add('dragging-over'); });
  canvasContainer.addEventListener('dragleave', (e) => { e.preventDefault(); e.stopPropagation(); canvasContainer.classList.remove('dragging-over'); });
  canvasContainer.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); canvasContainer.classList.remove('dragging-over'); });

  // Timeline event listeners
  timelinePlayButton.addEventListener('click', toggleTimelinePlayback);
  timelineStopButton.addEventListener('click', stopTimelinePlayback);
  currentFrameInput.addEventListener('change', (e) => {
    let newFrame = parseInt(e.target.value);
    const maxFrames = parseInt(document.getElementById('exportTotalFrames').value) || 80;
    if (isNaN(newFrame) || newFrame < 0) {
      newFrame = 0;
    }
    if (newFrame >= maxFrames) {
        newFrame = maxFrames - 1;
    }
    currentFrame = newFrame;
    e.target.value = currentFrame; // Update input in case it was clamped
    updatePlayheadPosition();
  });
  zoomSlider.addEventListener('input', updateTimelineZoom);

  // Listen for resize to update timeline width
  window.addEventListener('resize', updateTimelineWidth);
}

// =========
// DRAW
// =========
function draw() {
  clear();
  
  if (backgroundImg) {
    image(backgroundImg, 0, 0, width, height);
  }

  // Draw a border around the canvas dimensions
  push();
  const borderColor = document.body.classList.contains('dark-mode') ? '#212529' : '#C5C5C5';
  stroke(borderColor);
  strokeWeight(5);
  noFill();
  rect(0, 0, width - 1, height - 1);
  pop();
  
  drawAllSplines();
  drawStaticShapes();
  drawSelectionBox();

  // Timeline playback logic
  if (isPlayingTimeline) {
    const now = millis();
    const elapsed = now - lastFrameTime;
    const exportFpsValue = parseInt(document.getElementById('exportFPS').value) || 30; // Use exportFPS for timeline playback
    const frameDuration = 1000 / exportFpsValue; // Milliseconds per frame

    if (elapsed >= frameDuration) {
      const exportTotalFramesValue = parseInt(document.getElementById('exportTotalFrames').value) || 80;
      if (currentFrame >= exportTotalFramesValue -1) { // Stop on the last frame
        if (loopingPreview && !isPlayingOnce) { // Only loop if loopingPreview is true and not play once mode
          currentFrame = 0; // Loop back to start
        } else {
          stopTimelinePlayback(); // Stop if not looping or if it was play once
          isPlayingOnce = false; // Reset flag
        }
      } else {
        currentFrame++;
      }
      currentFrameInput.value = currentFrame;
      updatePlayheadPosition();
      lastFrameTime = now - (elapsed % frameDuration); // Account for frame lag
    }
  }
  
  drawMovingShapes();
  if (draggedPoint) { drawDragIndicator(); }
}

// ======================================
// TIMELINE FUNCTIONS
// ======================================

function toggleTimelinePlayback() {
  isPlayingTimeline = !isPlayingTimeline;
  if (isPlayingTimeline) {
    timelinePlayButton.textContent = '⏸'; // Pause icon
    lastFrameTime = millis(); // Reset last frame time on play
  } else {
    timelinePlayButton.textContent = '▶'; // Play icon
    isPlayingOnce = false; // Stop any play-once sequence
  }
}

function stopTimelinePlayback() {
  isPlayingTimeline = false;
  isPlayingOnce = false;
  timelinePlayButton.textContent = '▶';
  currentFrame = 0;
  currentFrameInput.value = currentFrame;
  updatePlayheadPosition();
}

function updatePlayheadPosition() {
  const totalFrames = parseInt(document.getElementById('exportTotalFrames').value) || 80;
  // Ensure playhead doesn't go beyond the timeline width
  const playheadX = (currentFrame / (totalFrames - 1)) * (timelineWidth - (timelineWidth/totalFrames));
  timelinePlayhead.style.left = `${playheadX}px`;
  
  // Scroll tracks area to keep playhead in view if playing
  if (isPlayingTimeline) {
     const areaRect = tracksArea.getBoundingClientRect();
     if(playheadX < tracksArea.scrollLeft || playheadX > tracksArea.scrollLeft + areaRect.width) {
        tracksArea.scrollLeft = playheadX - areaRect.width / 2;
     }
  }
}

function updateTimelineZoom() {
    const zoomValue = zoomSlider.value;
    // Non-linear zoom for better control at lower zoom levels
    timelineWidth = (parseInt(document.getElementById('exportTotalFrames').value) || 80) * (zoomValue / 10);
    tracksArea.style.width = `${timelineWidth}px`;
    
    // Update all track items to reflect new zoom level
    const allItems = [...splines, ...staticShapes];
    allItems.forEach(item => {
        if (item.id) {
            const trackItemElement = tracksArea.querySelector(`.track-item[data-item-id="${item.id}"]`);
            if(trackItemElement) updateTrackItemPositionAndWidth(item, trackItemElement);
        }
    });

    updateTimelineRuler();
    updatePlayheadPosition();
}

function updateTimelineWidth() {
  // This is a master function to recalculate timeline display properties
  updateTimelineZoom();
}


function updateTimelineRuler() {
    const ruler = document.createElement('div');
    ruler.className = 'timeline-ruler';

    const existingRuler = tracksArea.querySelector('.timeline-ruler');
    if (existingRuler) {
        tracksArea.removeChild(existingRuler);
    }

    const totalFrames = parseInt(document.getElementById('exportTotalFrames').value) || 80;
    const pixelsPerFrame = timelineWidth / totalFrames;

    // Determine mark spacing based on zoom level
    let majorMarkInterval = 100;
    let minorMarkInterval = 10;
    if (pixelsPerFrame > 10) {
        majorMarkInterval = 10;
        minorMarkInterval = 1;
    } else if (pixelsPerFrame < 1) {
        majorMarkInterval = 200;
        minorMarkInterval = 20;
    }


    for (let i = 0; i <= totalFrames; i++) {
        if (i % minorMarkInterval === 0) {
            const mark = document.createElement('div');
            mark.className = 'ruler-mark';
            mark.style.left = `${i * pixelsPerFrame}px`;
            
            if (i % majorMarkInterval === 0) {
                mark.style.height = '100%';
                mark.textContent = i;
            } else {
                 mark.style.height = '50%';
            }
            ruler.appendChild(mark);
        }
    }
    tracksArea.prepend(ruler);
}


function updateTotalFramesDisplay() {
  totalFramesDisplay.textContent = document.getElementById('exportTotalFrames').value || 80;
  updateTimelineWidth();
}


function updateTrackItemPositionAndWidth(item, trackItemElement) {
    const totalFrames = parseInt(document.getElementById('exportTotalFrames').value) || 80;
    if (totalFrames === 0) return;
    const pixelsPerFrame = timelineWidth / totalFrames;
    const itemStartFrame = item.startFrame || 0;
    const itemTotalFrames = item.totalFrames || 1;
    trackItemElement.style.left = `${itemStartFrame * pixelsPerFrame}px`;
    trackItemElement.style.width = `${itemTotalFrames * pixelsPerFrame}px`;
}


/**
 * Adds a new item to the timeline tracks.
 * @param {object} item - The spline or static shape object.
 * @param {string} type - 'Spline' or 'Shape'.
 */
function addTrackItem(item, type) {
  const trackRow = document.createElement('div');
  trackRow.className = 'track-row';
  trackRow.dataset.itemId = item.id; // Store item ID for reference

  const trackItem = document.createElement('div');
  trackItem.className = 'track-item';
  
  const displayName = `${type} ${item.id.split('-')[2] % 100}`; // Display a simple name
  trackItem.textContent = displayName;
  trackItem.dataset.itemId = item.id;
  trackItem.style.backgroundColor = item.lineColor || item.fillColor;

  updateTrackItemPositionAndWidth(item, trackItem);

  const leftHandle = document.createElement('div');
  leftHandle.className = 'track-item-handle left';
  const rightHandle = document.createElement('div');
  rightHandle.className = 'track-item-handle right';

  trackItem.appendChild(leftHandle);
  trackItem.appendChild(rightHandle);

  trackRow.appendChild(trackItem);
  tracksArea.appendChild(trackRow);

  const trackHeader = document.createElement('div');
  trackHeader.className = 'track-header';
  trackHeader.textContent = displayName;
  trackHeader.dataset.itemId = item.id;
  trackHeadersContainer.appendChild(trackHeader);

  trackItem.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    handleTrackItemMouseDown(e, item, trackItem);
  });
  leftHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    handleTrackItemResizeMouseDown(e, item, trackItem, 'left');
  });
  rightHandle.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    handleTrackItemResizeMouseDown(e, item, trackItem, 'right');
  });
}

let draggedTrackItem = null;
let resizeDirection = null;
let dragStartX = 0;
let initialItemStartFrame = 0;
let initialItemTotalFrames = 0;

function handleTrackItemMouseDown(e, item, trackItemElement) {
  draggedTrackItem = { item: item, element: trackItemElement };
  dragStartX = e.clientX;
  initialItemStartFrame = item.startFrame || 0;
  document.addEventListener('mousemove', handleTrackItemMouseMove);
  document.addEventListener('mouseup', handleTrackItemMouseUp);
}

function handleTrackItemResizeMouseDown(e, item, trackItemElement, direction) {
  resizeDirection = direction;
  draggedTrackItem = { item: item, element: trackItemElement };
  dragStartX = e.clientX;
  initialItemStartFrame = item.startFrame || 0;
  initialItemTotalFrames = item.totalFrames || 1;
  document.addEventListener('mousemove', handleTrackItemMouseMove);
  document.addEventListener('mouseup', handleTrackItemMouseUp);
}

function handleTrackItemMouseMove(e) {
    if (!draggedTrackItem) return;

    const dx = e.clientX - dragStartX;
    const totalTimelineFrames = parseInt(document.getElementById('exportTotalFrames').value) || 80;
    const framesPerPixel = totalTimelineFrames / timelineWidth;
    const dFrames = Math.round(dx * framesPerPixel);

    const item = draggedTrackItem.item;
    const element = draggedTrackItem.element;

    if (resizeDirection) {
        if (resizeDirection === 'left') {
            let newStartFrame = initialItemStartFrame + dFrames;
            let newTotalFrames = initialItemTotalFrames - dFrames;

            if (newStartFrame < 0) {
                newTotalFrames += newStartFrame;
                newStartFrame = 0;
            }
            if (newTotalFrames < 1) newTotalFrames = 1;
            
            item.startFrame = newStartFrame;
            item.totalFrames = newTotalFrames;

        } else if (resizeDirection === 'right') {
            let newTotalFrames = initialItemTotalFrames + dFrames;
            if (newTotalFrames < 1) newTotalFrames = 1;
            item.totalFrames = newTotalFrames;
        }
    } else { // Dragging
        let newStartFrame = initialItemStartFrame + dFrames;
        if (newStartFrame < 0) newStartFrame = 0;
        
        const itemTotalFrames = item.totalFrames || 1;
        if (newStartFrame + itemTotalFrames > totalTimelineFrames) {
            newStartFrame = totalTimelineFrames - itemTotalFrames;
        }
        item.startFrame = newStartFrame;
    }

    updateTrackItemPositionAndWidth(item, element);
    if (item === selectedSpline || item === selectedStaticShape) {
        updateSelectedItemUI(); // Live update sidebar
    }
}


function handleTrackItemMouseUp() {
  if (draggedTrackItem) {
    // FIX: Update UI in the sidebar if the dragged item was the selected one.
    const item = draggedTrackItem.item;
    if (item === selectedSpline || item === selectedStaticShape) {
        updateSelectedItemUI();
    }
    recordState(); // Save state after drag/resize
    draggedTrackItem = null;
    resizeDirection = null;
    document.removeEventListener('mousemove', handleTrackItemMouseMove);
    document.removeEventListener('mouseup', handleTrackItemMouseUp);
  }
}

// ======================================
// UNDO / REDO SYSTEM
// ======================================

function captureState() {
    const serializableSplines = splines.map(s => {
        const splineCopy = { ...s };
        splineCopy.points = s.points.map(p => ({ x: p.x, y: p.y }));
        return splineCopy;
    });

    const serializableStaticShapes = staticShapes.map(s => {
        const shapeCopy = { ...s };
        shapeCopy.pos = { x: s.pos.x, y: s.pos.y };
        return shapeCopy;
    });

    return {
        splines: serializableSplines,
        staticShapes: serializableStaticShapes,
        exportFPS: parseInt(document.getElementById('exportFPS').value),
        exportTotalFrames: parseInt(document.getElementById('exportTotalFrames').value),
        splineColorIndex: splineColorIndex,
        currentFrame: currentFrame,
    };
}

function applyState(state) {
    splines = state.splines.map(s => {
        const splineCopy = { ...s };
        splineCopy.points = s.points.map(p => createVector(p.x, p.y));
        return splineCopy;
    });

    staticShapes = state.staticShapes.map(s => {
        const shapeCopy = { ...s };
        shapeCopy.pos = createVector(s.pos.x, s.pos.y);
        return shapeCopy;
    });

    tracksArea.innerHTML = '';
    trackHeadersContainer.innerHTML = '';
    tracksArea.appendChild(timelinePlayhead); 

    splines.forEach(s => addTrackItem(s, 'Spline'));
    staticShapes.forEach(s => addTrackItem(s, 'Shape'));

    document.getElementById('exportFPS').value = state.exportFPS;
    document.getElementById('exportTotalFrames').value = state.exportTotalFrames;
    splineColorIndex = state.splineColorIndex;
    currentFrame = state.currentFrame || 0; 
    currentFrameInput.value = currentFrame;

    updateTotalFramesDisplay();
    updatePlayheadPosition();

    selectedSpline = null;
    selectedStaticShape = null;
    selectedPoint = null;
    multiSelection = [];
    if (splines.length > 0) {
        selectSpline(splines[splines.length - 1]);
    } else if (staticShapes.length > 0) {
        selectStaticShape(staticShapes[staticShapes.length - 1]);
    } else {
        updateSelectedItemUI();
    }
}

function recordState() {
    historyIndex++;
    history[historyIndex] = captureState();
    history.length = historyIndex + 1; 
    updateUndoRedoButtons();
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        applyState(history[historyIndex]);
        updateUndoRedoButtons();
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        applyState(history[historyIndex]);
        updateUndoRedoButtons();
    }
}

function updateUndoRedoButtons() {
    document.getElementById('undoBtn').disabled = historyIndex <= 0;
    document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
}

// ======================================
// ITEM CREATION AND SELECTION LOGIC
// ======================================
function addNewSpline() {
  const defaultSettings = {
    startFrame: 0, totalFrames: 80, shapeSizeX: 30, shapeSizeY: 30, shapeType: 'circle',
    fillColor: '#ffffff', strokeColor: '#000000', strokeWeight: 1, tension: 0, easing: 'linear',
  };
  const yOffset = (splines.length % 10) * 20;
  const newSpline = {
    ...defaultSettings,
    points: [createVector(width * 0.25, height / 2 - 50 + yOffset), createVector(width * 0.75, height / 2 - 50 + yOffset)],
    lineColor: splineColors[splineColorIndex],
    id: `spline-${Date.now()}-${splines.length}`
  };
  splineColorIndex = (splineColorIndex + 1) % splineColors.length;
  splines.push(newSpline);
  addTrackItem(newSpline, 'Spline');
  selectSpline(newSpline);
  recordState();
}

function addStaticShape() {
  const defaultSettings = {
    startFrame: 0, totalFrames: 80, shapeSizeX: 30, shapeSizeY: 30, shapeType: 'square',
    fillColor: '#ffffff', strokeColor: '#000000', strokeWeight: 1
  };
  const xOffset = (staticShapes.length % 5) * 20;
  const yOffset = (staticShapes.length % 5) * 20;
  const newShape = {
    ...defaultSettings,
    pos: createVector(width / 2 + xOffset, height / 2 + yOffset),
    isStatic: true,
    id: `shape-${Date.now()}-${staticShapes.length}`
  };
  staticShapes.push(newShape);
  addTrackItem(newShape, 'Shape');
  selectStaticShape(newShape);
  recordState();
}

function deleteSelectedSpline() {
  if (selectedSpline) {
    const index = splines.indexOf(selectedSpline);
    if (index > -1) {
      const trackItemElement = tracksArea.querySelector(`[data-item-id="${selectedSpline.id}"]`);
      if (trackItemElement) trackItemElement.parentElement.remove();
      const trackHeaderElement = trackHeadersContainer.querySelector(`[data-item-id="${selectedSpline.id}"]`);
      if (trackHeaderElement) trackHeaderElement.remove();

      splines.splice(index, 1);
      selectedSpline = null;
      selectedPoint = null;
      if (splines.length > 0) {
        selectSpline(splines[splines.length - 1]);
      } else if (staticShapes.length > 0) {
        selectStaticShape(staticShapes[staticShapes.length - 1]);
      } else {
        updateSelectedItemUI();
      }
      recordState();
    }
  } else {
    alert("No spline selected to delete.");
  }
}

function selectSpline(spline) {
  selectedSpline = spline;
  selectedStaticShape = null;
  multiSelection = [];
  updateSelectedItemUI();
  updateTrackItemSelection(spline);
}

function selectStaticShape(shape) {
  selectedStaticShape = shape;
  selectedSpline = null;
  selectedPoint = null;
  multiSelection = [];
  updateSelectedItemUI();
  updateTrackItemSelection(shape);
}

function updateSelectedItemUI() {
  const controlsContainer = document.getElementById('spline-controls');
  const itemSpecificControls = document.getElementById('item-specific-controls');
  const h3 = controlsContainer.querySelector('h3');
  const item = selectedSpline || selectedStaticShape;

  if (multiSelection.length > 0) {
      h3.textContent = `(${multiSelection.length} Items Selected)`;
      itemSpecificControls.style.display = 'none';
      updateTrackItemSelection(null);
      return;
  }
  
  if (item) {
    itemSpecificControls.style.display = 'block';
    document.getElementById('selectedSizeX').value = item.shapeSizeX;
    document.getElementById('selectedSizeY').value = item.shapeSizeY;
    document.getElementById('selectedType').value = item.shapeType;
    document.getElementById('selectedFillColor').value = item.fillColor;
    document.getElementById('selectedStrokeColor').value = item.strokeColor;
    document.getElementById('selectedStrokeWeight').value = item.strokeWeight;
    
    const splineOnlyControlGroups = [
        document.getElementById('selectedStartFrame').parentElement,
        document.getElementById('selectedTotalFrames').parentElement,
        document.getElementById('selectedTension').parentElement,
        document.getElementById('selectedEasing').parentElement
    ];

    if (selectedSpline) {
      h3.textContent = 'Selected Spline Control';
      splineOnlyControlGroups.forEach(el => el.style.display = 'flex');
      document.getElementById('selectedStartFrame').value = item.startFrame;
      document.getElementById('selectedTotalFrames').value = item.totalFrames;
      document.getElementById('selectedTension').value = item.tension;
      document.getElementById('selectedEasing').value = item.easing;
    } else {
      h3.textContent = 'Selected Shape Control';
      splineOnlyControlGroups.forEach(el => el.style.display = 'none');
    }
    updateTrackItemSelection(item);
  } else {
    h3.textContent = 'No Item Selected';
    itemSpecificControls.style.display = 'none';
    updateTrackItemSelection(null);
  }
}

function updateTrackItemSelection(selectedItem) {
  tracksArea.querySelectorAll('.track-item').forEach(item => item.classList.remove('selected'));
  trackHeadersContainer.querySelectorAll('.track-header').forEach(header => header.classList.remove('selected'));

  if (selectedItem && selectedItem.id) {
    const trackItemElement = tracksArea.querySelector(`.track-item[data-item-id="${selectedItem.id}"]`);
    if (trackItemElement) trackItemElement.classList.add('selected');
    const trackHeaderElement = trackHeadersContainer.querySelector(`.track-header[data-item-id="${selectedItem.id}"]`);
    if (trackHeaderElement) trackHeaderElement.classList.add('selected');
  }
}

function updateSelectedItem() {
  const item = selectedSpline || selectedStaticShape;
  if (!item || multiSelection.length > 0) return;

  item.shapeSizeX = parseInt(document.getElementById('selectedSizeX').value);
  item.shapeSizeY = parseInt(document.getElementById('selectedSizeY').value);
  item.shapeType = document.getElementById('selectedType').value;
  item.fillColor = document.getElementById('selectedFillColor').value;
  item.strokeColor = document.getElementById('selectedStrokeColor').value;
  item.strokeWeight = parseFloat(document.getElementById('selectedStrokeWeight').value);
  
  if (selectedSpline) {
    item.startFrame = parseInt(document.getElementById('selectedStartFrame').value) || 0;
    item.totalFrames = parseInt(document.getElementById('selectedTotalFrames').value) || 1;
    item.tension = parseFloat(document.getElementById('selectedTension').value);
    item.easing = document.getElementById('selectedEasing').value;
  }

  if (item.id) {
    const trackItemElement = tracksArea.querySelector(`.track-item[data-item-id="${item.id}"]`);
    if (trackItemElement) {
        updateTrackItemPositionAndWidth(item, trackItemElement);
        trackItemElement.style.backgroundColor = item.lineColor || item.fillColor;
    }
  }
}

function clearAll() {
  splines = [];
  staticShapes = [];
  selectedSpline = null;
  selectedStaticShape = null;
  selectedPoint = null;
  multiSelection = [];
  splineColorIndex = 0;
  stopTimelinePlayback();

  tracksArea.innerHTML = '';
  trackHeadersContainer.innerHTML = '';
  tracksArea.appendChild(timelinePlayhead);

  recordState();
  addNewSpline();
}

function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  let theme;
  if (document.body.classList.contains('dark-mode')) {
    theme = 'dark';
    themeToggleButton.textContent = 'Switch to Light Mode';
  } else {
    theme = 'light';
    themeToggleButton.textContent = 'Switch to Dark Mode';
  }
  localStorage.setItem('splineEditorTheme', theme);
}

// ==============
// DRAWING (Helper functions)
// ==============
function drawAllSplines(c = window) {
  for (let spline of splines) {
    drawSpline(spline, spline === selectedSpline, c);
    for (let i = 0; i < spline.points.length; i++) {
      drawDirectionalArrow(spline.points[i], spline, i, c);
    }
  }
}

function drawStaticShapes(c = window) {
  for (const shape of staticShapes) {
    const isMultiSelected = multiSelection.includes(shape);
    c.fill(shape.fillColor);
    c.stroke(shape.strokeColor);
    c.strokeWeight(shape.strokeWeight);
    c.push();
    c.translate(shape.pos.x, shape.pos.y);
    drawShapeOnCanvas(c, shape.shapeType, shape.shapeSizeX, shape.shapeSizeY);
    c.pop();
    if (shape === selectedStaticShape || isMultiSelected) {
      c.push();
      c.noFill();
      c.stroke(isMultiSelected ? '#FF8C00' : '#0095E8');
      c.strokeWeight(isMultiSelected ? 2 : 3);
      c.rectMode(CENTER);
      c.rect(shape.pos.x, shape.pos.y, shape.shapeSizeX + 15, shape.shapeSizeY + 15);
      c.pop();
    }
  }
}

function drawSpline(spline, isSelected, c = window) {
  if (spline.points.length < 2) return;
  
  const anyPointMultiSelected = spline.points.some(p => multiSelection.includes(p));

  c.noFill();
  c.stroke(isSelected || anyPointMultiSelected ? '#ff0000' : spline.lineColor);
  c.strokeWeight(isSelected || anyPointMultiSelected ? 3 : 2);
  c.beginShape();
  c.vertex(spline.points[0].x, spline.points[0].y);
  if (spline.points.length > 1) {
    const tension = spline.tension / 6.0;
    for (let i = 0; i < spline.points.length - 1; i++) {
        const p1 = spline.points[i];
        const p2 = spline.points[i + 1];
        const p0 = i > 0 ? spline.points[i - 1] : p1;
        const p3 = i < spline.points.length - 2 ? spline.points[i + 2] : p2;
        const cp1x = p1.x + (p2.x - p0.x) * tension;
        const cp1y = p1.y + (p2.y - p0.y) * tension;
        const cp2x = p2.x - (p3.x - p1.x) * tension;
        const cp2y = p2.y - (p3.y - p1.y) * tension;
        c.bezierVertex(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }
  c.endShape();
}

function drawDirectionalArrow(p, spline, pointIndex, c = window) {
    if (spline.points.length < 2) return;
    let direction;
    const arrowSize = 12;

    if (spline.points.length >= 2) {
        if (pointIndex === 0) {
            direction = p5.Vector.sub(getPointOnSegment(spline, 0, 0.01), p);
        } else if (pointIndex === spline.points.length - 1) {
            direction = p5.Vector.sub(p, getPointOnSegment(spline, pointIndex - 1, 0.99));
        } else {
            const prev = spline.points[pointIndex - 1];
            const next = spline.points[pointIndex + 1];
            direction = p5.Vector.sub(next, prev);
        }
    }
    if (!direction || direction.mag() === 0) direction = createVector(1, 0);

    direction.normalize().mult(arrowSize);
    const isSelected = (selectedPoint === p);
    const isMultiSelected = multiSelection.includes(p);
    c.push();
    c.translate(p.x, p.y);
    c.rotate(direction.heading());
    if (isSelected || isMultiSelected) {
        c.fill(isMultiSelected ? '#FF8C00' : '#FF0000');
        c.stroke(isMultiSelected ? '#cc7000' : '#cc0000');
    } else {
        c.fill(0, 150, 255, 153);
        c.stroke(0, 100, 255);
    }
    c.strokeWeight(1.5);
    c.beginShape();
    c.vertex(arrowSize, 0);
    c.vertex(-arrowSize * 0.6, arrowSize * 0.5);
    c.vertex(-arrowSize * 0.3, 0);
    c.vertex(-arrowSize * 0.6, -arrowSize * 0.5);
    c.endShape(CLOSE);
    c.pop();
}

function drawMovingShapes(c = window) {
  const frame = isPlayingTimeline ? currentFrame : (isExporting ? exportProgress : currentFrame);

  for (let spline of splines) {
    if (frame >= spline.startFrame && frame < (spline.startFrame + spline.totalFrames)) {
      const relativeFrame = frame - spline.startFrame;
      const progress = relativeFrame / (spline.totalFrames -1);
      const currentPos = getCurrentSplinePosition(spline, progress);
      
      if (!currentPos) continue;

      const isMultiSelected = multiSelection.includes(spline) || spline.points.some(p => multiSelection.includes(p));

      c.fill(spline.fillColor);
      c.stroke(spline.strokeColor);
      c.strokeWeight(spline.strokeWeight);
      c.push();
      c.translate(currentPos.x, currentPos.y);
      drawShapeOnCanvas(c, spline.shapeType, spline.shapeSizeX, spline.shapeSizeY);
      c.pop();
      if (spline === selectedSpline || isMultiSelected) {
        c.push();
        c.noFill();
        c.stroke(isMultiSelected ? '#FF8C00' : '#0095E8');
        c.strokeWeight(isMultiSelected ? 2 : 3);
        c.rectMode(CENTER);
        c.rect(currentPos.x, currentPos.y, spline.shapeSizeX + 15, spline.shapeSizeY + 15);
        c.pop();
      }
    }
  }
}

function drawSelectionBox() {
    if (selectionBox) {
        push();
        fill(0, 100, 255, 50);
        stroke(0, 100, 255, 200);
        strokeWeight(1.5);
        drawingContext.setLineDash([6, 3]);

        const x = selectionBox.w > 0 ? selectionBox.x : selectionBox.x + selectionBox.w;
        const y = selectionBox.h > 0 ? selectionBox.y : selectionBox.y + selectionBox.h;
        const w = abs(selectionBox.w);
        const h = abs(selectionBox.h);
        rect(x, y, w, h);

        drawingContext.setLineDash([]);
        pop();
    }
}

function drawDragIndicator() {
    if (draggedPoint) {
        push();
        stroke(255, 0, 0);
        strokeWeight(2);
        line(draggedPoint.x - 5, draggedPoint.y, draggedPoint.x + 5, draggedPoint.y);
        line(draggedPoint.x, draggedPoint.y - 5, draggedPoint.x, draggedPoint.y + 5);
        pop();
    }
}

// ======================================
// SELECTION HELPER FUNCTIONS
// ======================================

function toggleItemInMultiSelection(item) {
    const index = multiSelection.indexOf(item);
    if (index > -1) {
        multiSelection.splice(index, 1);
    } else {
        multiSelection.push(item);
    }
}

function toggleSplineInMultiSelection(spline) {
    const anyPointMultiSelected = spline.points.some(p => multiSelection.includes(p));

    if (anyPointMultiSelected) {
        multiSelection = multiSelection.filter(item => !spline.points.includes(item));
    } else {
        spline.points.forEach(p => {
            if (!multiSelection.includes(p)) {
                multiSelection.push(p);
            }
        });
    }
}

// ==============
// INTERACTION
// ==============
function keyPressed() {
    if (document.activeElement.tagName === "INPUT") return; // Ignore key presses if typing in an input
    if (keyIsDown(CONTROL)) {
        if (key.toLowerCase() === 'z') {
            undo();
        } else if (key.toLowerCase() === 'y') {
            redo();
        }
    }
}

function mousePressed() {
    const timelineRect = timelineTracksContainer.getBoundingClientRect();
    if (mouseX >= timelineRect.left && mouseX <= timelineRect.right &&
        mouseY >= timelineRect.top && mouseY <= timelineRect.bottom) {
      return;
    }

    if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height || isExporting) return;

    if (keyIsDown(CONTROL)) {
        if (selectedStaticShape && !multiSelection.includes(selectedStaticShape)) {
            multiSelection.push(selectedStaticShape);
        }
        if (selectedSpline) {
            const targetItems = selectedPoint ? [selectedPoint] : selectedSpline.points;
            targetItems.forEach(p => {
                if (!multiSelection.includes(p)) {
                    multiSelection.push(p);
                }
            });
        }
        
        selectedSpline = null;
        selectedStaticShape = null;
        selectedPoint = null;

        let clickedOnSomething = false;
        
        for (let i = staticShapes.length - 1; i >= 0; i--) {
            const shape = staticShapes[i];
            if (mouseX > shape.pos.x - shape.shapeSizeX / 2 && mouseX < shape.pos.x + shape.shapeSizeX / 2 &&
                mouseY > shape.pos.y - shape.shapeSizeY / 2 && mouseY < shape.pos.y + shape.shapeSizeY / 2) {
                toggleItemInMultiSelection(shape);
                clickedOnSomething = true;
                break;
            }
        }

        if (!clickedOnSomething) {
            for (let s = splines.length - 1; s >= 0; s--) {
                const spline = splines[s];
                for (let i = 0; i < spline.points.length; i++) {
                    const p = spline.points[i];
                    if (dist(mouseX, mouseY, p.x, p.y) < 15) {
                        toggleItemInMultiSelection(p);
                        clickedOnSomething = true;
                        break;
                    }
                }
                if (clickedOnSomething) break;
            }
        }

        if (!clickedOnSomething) {
            for (let i = splines.length - 1; i >= 0; i--) {
                const spline = splines[i];
                if (isMouseOnSpline(spline, 20)) {
                    toggleSplineInMultiSelection(spline);
                    clickedOnSomething = true;
                    break;
                }
            }
        }

        if (!clickedOnSomething) {
            selectionBox = { x: mouseX, y: mouseY, w: 0, h: 0 };
        }

        updateSelectedItemUI();
        return;
    }

    if (multiSelection.length > 0) {
        let canStartDrag = false;
        for (const item of multiSelection) {
            const itemPos = item.pos || item;
            const itemSize = item.shapeSizeX ? item.shapeSizeX : 20;
            if (itemPos && dist(mouseX, mouseY, itemPos.x, itemPos.y) < itemSize) {
                canStartDrag = true;
                break;
            }
        }
        if (!canStartDrag) {
            for (const spline of splines) {
                const isSplineSelected = spline.points.length > 0 && spline.points.every(p => multiSelection.includes(p));
                if (isSplineSelected && isMouseOnSpline(spline, 20)) {
                    canStartDrag = true;
                    break;
                }
            }
        }
        
        if (canStartDrag) {
            isDraggingSelection = true;
            dragStartPos = createVector(mouseX, mouseY);
            return;
        }
    }

    multiSelection = [];
    isDraggingSelection = false;
    
    for (let i = staticShapes.length - 1; i >= 0; i--) {
        const shape = staticShapes[i];
        if (mouseX > shape.pos.x - shape.shapeSizeX / 2 && mouseX < shape.pos.x + shape.shapeSizeX / 2 &&
            mouseY > shape.pos.y - shape.shapeSizeY / 2 && mouseY < shape.pos.y + shape.shapeSizeY / 2) {
            draggedStaticShape = shape;
            selectStaticShape(shape);
            return;
        }
    }

    for (let s = splines.length - 1; s >= 0; s--) {
        const spline = splines[s];
        for (let i = 0; i < spline.points.length; i++) {
            const p = spline.points[i];
            if (dist(mouseX, mouseY, p.x, p.y) < 15) {
                draggedPoint = p;
                selectedPoint = p;
                selectedPointIndex = i;
                selectedSplineIndex = s;
                selectSpline(spline);
                return;
            }
        }
    }

    for (let i = splines.length - 1; i >= 0; i--) {
        const spline = splines[i];
        if (isMouseOnSpline(spline, 20)) { 
            draggedSpline = spline;
            selectSpline(spline);
            dragStartPos = createVector(mouseX, mouseY);
            return;
        }
    }
  
    selectedSpline = null;
    selectedStaticShape = null;
    selectedPoint = null;
    updateSelectedItemUI();
}

function mouseDragged() {
    if (isExporting || draggedTrackItem) return;
    
    if (selectionBox) {
        selectionBox.w = mouseX - selectionBox.x;
        selectionBox.h = mouseY - selectionBox.y;
    } else if (isDraggingSelection) {
        const currentMousePos = createVector(mouseX, mouseY);
        const delta = p5.Vector.sub(currentMousePos, dragStartPos);
        
        multiSelection.forEach(item => {
            if (item) {
                 const itemPos = item.pos || item;
                 if (itemPos && typeof itemPos.add === 'function') {
                    itemPos.add(delta);
                 }
            }
        });
       
        dragStartPos = currentMousePos;
        dragOccurred = true;
    } else if (draggedStaticShape) {
        draggedStaticShape.pos.x = constrain(mouseX, 0, width);
        draggedStaticShape.pos.y = constrain(mouseY, 0, height);
        dragOccurred = true;
    } else if (draggedPoint) {
        draggedPoint.x = constrain(mouseX, 0, width);
        draggedPoint.y = constrain(mouseY, 0, height);
        dragOccurred = true;
    } else if (draggedSpline) {
        const currentMousePos = createVector(mouseX, mouseY);
        const delta = p5.Vector.sub(currentMousePos, dragStartPos);
        for (let point of draggedSpline.points) {
            point.add(delta);
        }
        dragStartPos = currentMousePos;
        dragOccurred = true;
    }
}


function mouseReleased() {
    if (isExporting || draggedTrackItem) return;

    if (selectionBox) {
        selectItemsInBox(selectionBox);
        selectionBox = null;
        updateSelectedItemUI();
        if (multiSelection.length > 0) recordState();
    } else if (dragOccurred) {
        recordState();
    }
    
    draggedPoint = null;
    draggedStaticShape = null;
    draggedSpline = null;
    dragStartPos = null;
    isDraggingSelection = false;
    dragOccurred = false;
}

function selectItemsInBox(box) {
    const r = {
        x: box.w < 0 ? box.x + box.w : box.x,
        y: box.h < 0 ? box.y + box.h : box.y,
        w: abs(box.w),
        h: abs(box.h)
    };

    multiSelection = [];
    selectedSpline = null;
    selectedStaticShape = null;
    
    for (const shape of staticShapes) {
        const shapeLeft = shape.pos.x - shape.shapeSizeX / 2;
        const shapeRight = shape.pos.x + shape.shapeSizeX / 2;
        const shapeTop = shape.pos.y - shape.shapeSizeY / 2;
        const shapeBottom = shape.pos.y + shape.shapeSizeY / 2;

        if (shapeRight > r.x && shapeLeft < r.x + r.w &&
            shapeBottom > r.y && shapeTop < r.y + r.h) {
            multiSelection.push(shape);
        }
    }
    for (const spline of splines) {
        for (const point of spline.points) {
            if (point.x > r.x && point.x < r.x + r.w && point.y > r.y && point.y < r.y + r.h) {
                if(!multiSelection.includes(point)) multiSelection.push(point);
            }
        }
    }
}


function doubleClicked() {
  if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height || isExporting) return;
  const mousePos = createVector(mouseX, mouseY);
  let bestMatch = { spline: null, pointData: { distance: Infinity } };

  for (const spline of splines) {
    if (spline.points.length < 2) continue;
    const closestPointData = findClosestPointOnSpline(spline, mousePos);
    if (closestPointData.distance < bestMatch.pointData.distance) {
      bestMatch.spline = spline;
      bestMatch.pointData = closestPointData;
    }
  }

  if (bestMatch.spline && bestMatch.pointData.distance < 20) {
    const targetSpline = bestMatch.spline;
    const newPoint = bestMatch.pointData.point;
    const segmentIndex = bestMatch.pointData.segmentIndex;
    targetSpline.points.splice(segmentIndex + 1, 0, newPoint);
    selectSpline(targetSpline);
    selectedPoint = newPoint;
    selectedPointIndex = segmentIndex + 1;
    recordState();
  }
}

function findClosestPointOnSpline(spline, pos) {
  let closest = { point: null, distance: Infinity, segmentIndex: -1, t: 0 };
  for (let i = 0; i < spline.points.length - 1; i++) {
    for (let t = 0; t <= 1; t += 0.01) {
      const p = getPointOnSegment(spline, i, t);
      if (p) {
        const d = dist(pos.x, pos.y, p.x, p.y);
        if (d < closest.distance) {
          closest.distance = d;
          closest.point = p;
          closest.segmentIndex = i;
          closest.t = t;
        }
      }
    }
  }
  return closest;
}

function isMouseOnSpline(spline, tolerance) {
  if (spline.points.length < 2) return false;
  const closestData = findClosestPointOnSpline(spline, createVector(mouseX, mouseY));
  return closestData.distance < tolerance;
}

// ==============================
// POINT & SHAPE MANAGEMENT
// ==============================
/**
 * [FIXED] Clones the selected item(s). Correctly handles single items, multi-selections,
 * and creates true copies instead of moving the originals.
 */
function cloneSelectedItem() {
    const offset = createVector(20, 20);
    const newClonedItems = [];
    let stateChanged = false;

    // Determine the set of unique top-level items to clone
    const itemsToClone = new Set();
    const selection = multiSelection.length > 0 ? multiSelection : 
                      (selectedSpline ? [selectedSpline] : (selectedStaticShape ? [selectedStaticShape] : []));
    
    if (selection.length === 0) return;

    selection.forEach(item => {
        if (item.isStatic) { // It's a static shape object
            itemsToClone.add(item);
        } else if (item.points) { // It's a whole spline object
            itemsToClone.add(item);
        } else { // It's a point (p5.Vector), so find its parent spline
            for (const spline of splines) {
                if (spline.points.includes(item)) {
                    itemsToClone.add(spline);
                    break;
                }
            }
        }
    });

    // Now, iterate over the unique items and clone them
    itemsToClone.forEach(item => {
        stateChanged = true;
        if (item.points) { // It's a spline
            const original = item;
            const newSpline = {
                ...original,
                points: original.points.map(p => createVector(p.x + offset.x, p.y + offset.y)),
                lineColor: splineColors[splineColorIndex],
                id: `spline-${Date.now()}-${splines.length}`
            };
            splineColorIndex = (splineColorIndex + 1) % splineColors.length;
            splines.push(newSpline);
            addTrackItem(newSpline, 'Spline');
            newClonedItems.push(newSpline);
        } else if (item.isStatic) { // It's a shape
            const original = item;
            const newShape = {
                ...original,
                pos: createVector(original.pos.x + offset.x, original.pos.y + offset.y),
                id: `shape-${Date.now()}-${staticShapes.length}`
            };
            staticShapes.push(newShape);
            addTrackItem(newShape, 'Shape');
            newClonedItems.push(newShape);
        }
    });

    if (stateChanged) {
        // Clear old selection
        selectedSpline = null;
        selectedStaticShape = null;
        selectedPoint = null;
        multiSelection = [];

        // Select the newly created items
        if (newClonedItems.length === 1) {
            const newItem = newClonedItems[0];
            if (newItem.points) selectSpline(newItem);
            else selectStaticShape(newItem);
        } else {
            newClonedItems.forEach(clonedItem => {
                if (clonedItem.points) {
                    clonedItem.points.forEach(p => multiSelection.push(p));
                } else {
                    multiSelection.push(clonedItem);
                }
            });
            updateSelectedItemUI();
        }
        recordState();
    }
}


function removeSelectedItem() {
  let stateChanged = false;
  
  // Determine which items to delete based on selection
  const itemsToDelete = new Set();
  if (multiSelection.length > 0) {
      multiSelection.forEach(item => {
          if (item.isStatic) {
              itemsToDelete.add(item);
          } else { // It's a point
              for (const spline of splines) {
                  if(spline.points.includes(item)) {
                      // If deleting all points of a spline, just delete the spline
                      if (spline.points.every(p => multiSelection.includes(p))) {
                          itemsToDelete.add(spline);
                      } else {
                          itemsToDelete.add(item); // Delete individual point
                      }
                      break;
                  }
              }
          }
      });
  } else if (selectedPoint && selectedSpline) {
      itemsToDelete.add(selectedPoint);
  } else if (selectedStaticShape) {
      itemsToDelete.add(selectedStaticShape);
  }

  if (itemsToDelete.size === 0) return;

  itemsToDelete.forEach(item => {
      stateChanged = true;
      if (item.isStatic || item.points) { // It's a shape or a whole spline
          const arr = item.isStatic ? staticShapes : splines;
          const index = arr.indexOf(item);
          if (index > -1) {
              arr.splice(index, 1);
              const trackRow = tracksArea.querySelector(`.track-row[data-item-id="${item.id}"]`);
              if(trackRow) trackRow.remove();
              const trackHeader = trackHeadersContainer.querySelector(`.track-header[data-item-id="${item.id}"]`);
              if(trackHeader) trackHeader.remove();
          }
      } else { // It's an individual point
          for (const spline of splines) {
              const index = spline.points.indexOf(item);
              if (index > -1) {
                  if (spline.points.length > 2) {
                      spline.points.splice(index, 1);
                  } else {
                      alert("A spline must have at least 2 points. Delete the whole spline instead.");
                      stateChanged = false; // Revert change status
                  }
                  break;
              }
          }
      }
  });

  if (stateChanged) {
      selectedPoint = null;
      selectedSpline = null;
      selectedStaticShape = null;
      multiSelection = [];
      updateSelectedItemUI();
      recordState();
  }
}

function addPointToSpline() {
  if (!selectedSpline || selectedSpline.points.length < 2) { return; }
  let longestSegment = { index: -1, length: 0 };
  for (let i = 0; i < selectedSpline.points.length - 1; i++) {
    let segmentLength = 0;
    const steps = 20;
    let lastPoint = getPointOnSegment(selectedSpline, i, 0);
    for (let j = 1; j <= steps; j++) {
      const t = j / steps;
      const currentPoint = getPointOnSegment(selectedSpline, i, t);
      segmentLength += dist(lastPoint.x, lastPoint.y, currentPoint.x, currentPoint.y);
      lastPoint = currentPoint;
    }
    if (segmentLength > longestSegment.length) {
      longestSegment.length = segmentLength;
      longestSegment.index = i;
    }
  }
  if (longestSegment.index !== -1) {
    const newPoint = getPointOnSegment(selectedSpline, longestSegment.index, 0.5);
    selectedSpline.points.splice(longestSegment.index + 1, 0, newPoint);
    recordState();
  }
}

// ==============================
// PREVIEW CONTROLS
// ==============================
function toggleLooping() {
  loopingPreview = !loopingPreview;
  if (loopingPreview) {
    loopPreviewButton.textContent = 'Loop Preview: ON';
    loopPreviewButton.style.backgroundColor = 'var(--accent-success)';
    if (!isPlayingTimeline) {
      toggleTimelinePlayback();
    }
  } else {
    loopPreviewButton.textContent = 'Loop Preview: OFF';
    loopPreviewButton.style.backgroundColor = 'var(--accent-danger)';
  }
}

function playOnce() {
  stopTimelinePlayback();
  isPlayingTimeline = true;
  lastFrameTime = millis();
  timelinePlayButton.textContent = '⏸';
  isPlayingOnce = true;
}

// ==============================
// SPLINE & CANVAS MATH/LOGIC
// ==============================
function applyEasing(t, easingType) {
  switch (easingType) {
    case 'easeIn': return t * t;
    case 'easeOut': return t * (2 - t);
    case 'easeInOut': return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default: return t;
  }
}

function getCurrentSplinePosition(spline, progress) {
  progress = constrain(progress, 0, 1);
  
  const easedProgress = applyEasing(progress, spline.easing);
  const targetDistance = easedProgress * calculateSplineLength(spline);
  const positionData = getPointAtDistance(spline, targetDistance);
  return positionData ? positionData.point : null;
}

function calculateSplineLength(spline) {
  if (spline.points.length < 2) return 0;
  let totalLength = 0;
  const segments = 100;
  for (let i = 0; i < spline.points.length - 1; i++) {
    let prevPoint = getPointOnSegment(spline, i, 0);
    for (let j = 1; j <= segments; j++) {
      const t = j / segments;
      const currentPoint = getPointOnSegment(spline, i, t);
      if(currentPoint) {
        totalLength += dist(prevPoint.x, prevPoint.y, currentPoint.x, currentPoint.y);
        prevPoint = currentPoint;
      }
    }
  }
  return totalLength;
}

function getPointAtDistance(spline, targetDistance) {
  if (spline.points.length < 2) return null;
  let accumulatedDistance = 0;
  const segments = 100;
  if (targetDistance <= 0) return { point: spline.points[0].copy(), segmentIndex: 0, t: 0 };
  for (let i = 0; i < spline.points.length - 1; i++) {
    let segmentStart = getPointOnSegment(spline, i, 0);
    for (let j = 1; j <= segments; j++) {
      const t = j / segments;
      const segmentEnd = getPointOnSegment(spline, i, t);
      if (!segmentStart || !segmentEnd) continue;
      const segmentLength = dist(segmentStart.x, segmentStart.y, segmentEnd.x, segmentEnd.y);
      if (accumulatedDistance + segmentLength >= targetDistance) {
        const ratio = segmentLength === 0 ? 0 : (targetDistance - accumulatedDistance) / segmentLength;
        const point = p5.Vector.lerp(segmentStart, segmentEnd, ratio);
        return { point: point, segmentIndex: i, t: (j - 1 + ratio) / segments };
      }
      accumulatedDistance += segmentLength;
      segmentStart = segmentEnd;
    }
  }
  return { point: spline.points[spline.points.length - 1].copy(), segmentIndex: spline.points.length - 2, t: 1 };
}

function getPointOnSegment(spline, segmentIndex, t) {
  if (segmentIndex < 0 || segmentIndex >= spline.points.length - 1) return null;
  const p1 = spline.points[segmentIndex];
  const p2 = spline.points[segmentIndex + 1];
  if (!p1 || !p2) return null;
  
  const p0 = segmentIndex > 0 ? spline.points[segmentIndex - 1] : p1;
  const p3 = segmentIndex < spline.points.length - 2 ? spline.points[segmentIndex + 2] : p2;
  const tension = spline.tension / 6.0;
  const cp1x = p1.x + (p2.x - p0.x) * tension;
  const cp1y = p1.y + (p2.y - p0.y) * tension;
  const cp2x = p2.x - (p3.x - p1.x) * tension;
  const cp2y = p2.y - (p3.y - p1.y) * tension;
  const x = bezierPoint(p1.x, cp1x, cp2x, p2.x, t);
  const y = bezierPoint(p1.y, cp1y, cp2y, p2.y, t);
  return createVector(x, y);
}

function windowResized() { resizeCanvasToFit(); }

function resizeCanvasToFit() {
  const sidebarWidth = document.getElementById('spline-controls').offsetWidth;
  const timelineHeight = document.querySelector('.timeline-container').offsetHeight;
  const otherControlsHeight = document.querySelector('.spline-management').offsetHeight + document.querySelector('.export-container').offsetHeight;
  const horizontalMargin = sidebarWidth + 60; // More padding
  const verticalMargin = timelineHeight + otherControlsHeight + 80; // All controls + padding
  
  const maxDisplayWidth = window.innerWidth - horizontalMargin;
  const maxDisplayHeight = window.innerHeight - verticalMargin;

  let sourceWidth = backgroundImg ? originalImageDimensions.width : 1000;
  let sourceHeight = backgroundImg ? originalImageDimensions.height : 562;

  const ratio = Math.min(maxDisplayWidth / sourceWidth, maxDisplayHeight / sourceHeight, 1);
  const displayWidth = sourceWidth * ratio;
  const displayHeight = sourceHeight * ratio;

  if (Math.round(displayWidth) > 0 && Math.round(displayHeight) > 0) {
    document.getElementById('canvasWidth').value = Math.round(displayWidth);
    document.getElementById('canvasHeight').value = Math.round(displayHeight);
    updateCanvasSize();
  }
}

function updateCanvasSize() {
  const newWidth = parseInt(document.getElementById('canvasWidth').value);
  const newHeight = parseInt(document.getElementById('canvasHeight').value);
  if (newWidth !== width || newHeight !== height) {
    const originalWidth = width;
    const originalHeight = height;
    resizeCanvas(newWidth, newHeight);
    const scaleX = newWidth / originalWidth;
    const scaleY = newHeight / originalHeight;

    for (let spline of splines) {
      for (let point of spline.points) {
        point.x *= scaleX;
        point.y *= scaleY;
      }
    }
    for (let shape of staticShapes) {
        shape.pos.x *= scaleX;
        shape.pos.y *= scaleY;
    }
    recordState();
  }
}

function resetCanvasSize() {
  let targetWidth = backgroundImg ? originalImageDimensions.width : 1000;
  let targetHeight = backgroundImg ? originalImageDimensions.height : 562;
  document.getElementById('canvasWidth').value = targetWidth;
  document.getElementById('canvasHeight').value = targetHeight;
  updateCanvasSize();
}

// ======================================
// SCENE SAVE/LOAD (MODIFIED)
// ======================================
function handleSceneFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type === 'application/json' || file.name.endsWith('.json')) {
        loadSceneFromFile(file);
    } else if (file.type.startsWith('image/')) {
        loadAsRegularImage(file);
    } else {
        alert('Unsupported file type. Please select a .json scene file or an image.');
    }
     event.target.value = ''; // Reset file input
}

function gotFile(file) {
    if (file.type === 'image') {
        loadAsRegularImage(file);
    } else if (file.subtype === 'json') {
        loadSceneFromFile(file.file);
    } else {
        console.log('Drag-and-drop: Not a supported image or .json file!');
    }
}

function loadSceneFromFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const sceneData = JSON.parse(e.target.result);
            loadScene(sceneData); 
        } catch (err) {
            alert("Failed to parse scene file. It might be corrupted or not a valid scene file.");
            console.error("Failed to parse scene data:", err);
        }
    };
    reader.readAsText(file);
}

function loadAsRegularImage(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        backgroundImg = loadImage(e.target.result,
            img => {
                originalImageDimensions = { width: img.width, height: img.height };
                resizeCanvasToFit();
                recordState();
            },
            err => console.error('Error loading image:', err)
        );
    };
    reader.readAsDataURL(file.data || file);
}

function loadScene(sceneData) {
    const savedCanvasDimensions = sceneData.originalImageDimensions || { width: 1000, height: 562 };
    
    const loadState = () => {
        applyState(sceneData); // Apply state first
        
        // Then scale everything to the new canvas size
        const scaleX = width / savedCanvasDimensions.width;
        const scaleY = height / savedCanvasDimensions.height;
        const avgScale = (scaleX + scaleY) / 2;

        splines.forEach(s => {
            s.points.forEach(p => { p.x *= scaleX; p.y *= scaleY; });
            s.shapeSizeX = (s.shapeSizeX || 10) * avgScale;
            s.shapeSizeY = (s.shapeSizeY || 10) * avgScale;
        });
        staticShapes.forEach(s => {
            s.pos.x *= scaleX; s.pos.y *= scaleY;
            s.shapeSizeX = (s.shapeSizeX || 10) * avgScale;
            s.shapeSizeY = (s.shapeSizeY || 10) * avgScale;
        });
        
        if (splines.length > 0) selectSpline(splines[0]);
        else if (staticShapes.length > 0) selectStaticShape(staticShapes[0]);
        else updateSelectedItemUI();

        recordState();
    };

    if (sceneData.backgroundImgDataUrl) {
        backgroundImg = loadImage(sceneData.backgroundImgDataUrl,
            img => {
                originalImageDimensions = { width: img.width, height: img.height };
                document.getElementById('canvasWidth').value = originalImageDimensions.width;
                document.getElementById('canvasHeight').value = originalImageDimensions.height;
                resizeCanvas(originalImageDimensions.width, originalImageDimensions.height);
                loadState();
            },
            err => {
                console.error('Error loading background image from scene data:', err);
                backgroundImg = null;
                loadState();
            }
        );
    } else {
        backgroundImg = null;
        loadState();
    }
}

function exportScene() {
    const sceneData = captureState();
    sceneData.originalImageDimensions = { width: width, height: height };
    if (backgroundImg) {
        sceneData.backgroundImgDataUrl = backgroundImg.canvas.toDataURL('image/png');
    } else {
        sceneData.backgroundImgDataUrl = null;
    }

    const jsonDataString = JSON.stringify(sceneData);
    const blob = new Blob([jsonDataString], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spline-scene.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

// ==============
// EXPORT
// ==============
function startExport() {
  if (splines.length === 0 && staticShapes.length === 0) { alert("There is nothing to export."); return; }
  const mimeTypes = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  let supportedMimeType = null;
  if (window.MediaRecorder) {
    for (const mimeType of mimeTypes) { if (MediaRecorder.isTypeSupported(mimeType)) { supportedMimeType = mimeType; break; } }
  }
  if (!supportedMimeType) { alert("Video export not supported in this browser."); return; }
  if (isExporting) return;
  
  isExporting = true;
  exportOverlay.style.display = 'flex';
  progressBarFill.style.width = '0%';
  exportPercentage.textContent = '0%';
  exportFPS = parseInt(document.getElementById('exportFPS').value);
  exportTotalFrames = parseInt(document.getElementById('exportTotalFrames').value);

  stopTimelinePlayback();
  currentFrame = 0;

  exportFrameCount.textContent = `Frame 0 of ${exportTotalFrames}`;
  exportProgress = 0;
  recordedChunks = [];
  const exportWidth = width;
  const exportHeight = height;

  exportCanvas = createGraphics(exportWidth, exportHeight);
  exportCanvas.pixelDensity(1);
  exportStream = exportCanvas.elt.captureStream(exportFPS);
  mediaRecorder = new MediaRecorder(exportStream, { mimeType: supportedMimeType, videoBitsPerSecond: 5000000 });
  mediaRecorder.ondataavailable = e => e.data.size > 0 && recordedChunks.push(e.data);
  mediaRecorder.onstop = handleExportFinish;
  mediaRecorder.start();
  renderNextFrame();
}

function drawExportFrame() {
  const c = exportCanvas;
  c.clear();
  if (backgroundImg) {
    c.image(backgroundImg, 0, 0, c.width, c.height);
  } else {
    const bgColor = document.body.classList.contains('dark-mode') ? '#0d1117' : '#ffffff';
    c.background(bgColor);
  }
  
  // Draw static shapes (always visible)
  for (const shape of staticShapes) {
      c.push();
      c.fill(shape.fillColor);
      c.stroke(shape.strokeColor);
      c.strokeWeight(shape.strokeWeight);
      c.translate(shape.pos.x, shape.pos.y);
      drawShapeOnCanvas(c, shape.shapeType, shape.shapeSizeX, shape.shapeSizeY); 
      c.pop();
  }
  
  // Draw moving shapes
  for (const spline of splines) {
    if (exportProgress >= spline.startFrame && exportProgress < (spline.startFrame + spline.totalFrames)) {
      const relativeFrame = exportProgress - spline.startFrame;
      let splineProgress = spline.totalFrames > 1 ? relativeFrame / (spline.totalFrames - 1) : 1;
      const pos = getCurrentSplinePosition(spline, splineProgress);

      if (pos) {
        c.push();
        c.fill(spline.fillColor);
        c.stroke(spline.strokeColor);
        c.strokeWeight(spline.strokeWeight);
        c.translate(pos.x, pos.y);
        drawShapeOnCanvas(c, spline.shapeType, spline.shapeSizeX, spline.shapeSizeY);
        c.pop();
      }
    }
  }
}

function renderNextFrame() {
  if (!isExporting) return;
  if (exportProgress < exportTotalFrames) {
    drawExportFrame();
    const progressPercent = (exportProgress / exportTotalFrames) * 100;
    progressBarFill.style.width = `${progressPercent}%`;
    exportPercentage.textContent = `${Math.round(progressPercent)}%`;
    exportFrameCount.textContent = `Frame ${exportProgress + 1} of ${exportTotalFrames}`;
    exportProgress++;

    requestAnimationFrame(renderNextFrame);
  } else {
    progressBarFill.style.width = '100%';
    exportPercentage.textContent = '100%';
    exportFrameCount.textContent = `Completed ${exportTotalFrames} frames.`;
    finishExport();
  }
}

function drawShapeOnCanvas(canvas, type, sizeX, sizeY) {
  canvas.push();
  canvas.rectMode(canvas.CENTER);
  switch (type) {
    case 'circle': canvas.ellipse(0, 0, sizeX, sizeY); break;
    case 'square': canvas.rect(0, 0, sizeX, sizeY); break;
    case 'triangle': canvas.triangle(-sizeX / 2, sizeY / 2, sizeX / 2, sizeY / 2, 0, -sizeY / 2); break;
  }
  canvas.pop();
}

function handleExportFinish() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'spline-animation.webm';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 100);
  cleanupExport();
}

function finishExport() {
  if (mediaRecorder?.state === 'recording') {
    mediaRecorder.stop(); 
  } else {
    cleanupExport();
  }
}

function cancelExport() {
  isExporting = false; // This will stop the renderNextFrame loop
  if (mediaRecorder?.state === 'recording') {
      mediaRecorder.onstop = () => cleanupExport(); // Ensure cleanup happens after stop
      mediaRecorder.stop();
  } else {
      cleanupExport();
  }
}

function cleanupExport() {
  isExporting = false;
  if (exportOverlay) { exportOverlay.style.display = 'none'; }
  exportCanvas?.remove();
  exportStream?.getTracks().forEach(track => track.stop());
  exportCanvas = null;
  exportStream = null;
  mediaRecorder = null;
  stopTimelinePlayback();
}