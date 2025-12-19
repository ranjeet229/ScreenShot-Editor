class ScreenshotEditor {
  constructor() {
    this.canvas = document.getElementById("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.dropZone = document.getElementById("dropZone");
    this.toolbar = document.getElementById("toolbar");
    this.canvasContainer = document.getElementById("canvasContainer");

    this.currentTool = "blur";
    this.brushSize = 30;
    this.color = "#ff0000";
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currentX = 0;
    this.currentY = 0;

    this.undoStack = [];
    this.redoStack = [];
    this.maxStackSize = 50;

    this.originalImage = null;
    this.tempCanvas = document.createElement("canvas");
    this.tempCtx = this.tempCanvas.getContext("2d", {
      willReadFrequently: true,
    });

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
  }
  setupEventListeners() {
    document.addEventListener("paste", (e) => this.handlePaste(e));
    this.dropZone.addEventListener("dragover", (e) => this.handleDragOver(e));
    this.dropZone.addEventListener("dragleave", (e) => this.handleDragLeave(e));
    this.dropZone.addEventListener("drop", (e) => this.handleDrop(e));

    this.canvas.addEventListener("mousedown", (e) => this.startDrawing(e));
    this.canvas.addEventListener("mousemove", (e) => this.draw(e));
    this.canvas.addEventListener("mouseup", () => this.stopDrawing());
    this.canvas.addEventListener("mouseout", () => this.stopDrawing());

    document.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.addEventListener("click", (e) =>
        this.selectTool(e.target.closest("[data-tool]").dataset.tool)
      );
    });

    document.getElementById("brushSize").addEventListener("input", (e) => {
      this.brushSize = parseInt(e.target.value);
      document.getElementById("sizeValue").textContent = this.brushSize;
    });

    document.getElementById("colorPicker").addEventListener("input", (e) => {
      this.color = e.target.value;
    });

    document
      .getElementById("undoBtn")
      .addEventListener("click", () => this.undo());
    document
      .getElementById("redoBtn")
      .addEventListener("click", () => this.redo());
    document
      .getElementById("copyBtn")
      .addEventListener("click", () => this.copyToClipboard());
    document
      .getElementById("downloadBtn")
      .addEventListener("click", () => this.downloadImage());
    document
      .getElementById("newBtn")
      .addEventListener("click", () => this.loadNewImage());
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e)=>{
      if(e.ctrlKey || e.metaKey){
        if(e.key === 'z'){
          e.preventDefault();
          this.undo();
        }else if(e.key ==='y' || (e.shiftKey&& e.key ==='z')){
          e.preventDefault();
          this.redo();
        }
      }

      const toolMap = { b: 'blur', p: 'pixelate', r: 'rectangle', a: 'arrow', t: 'text' };
      if(toolMap[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey){
        this.selectTool(toolMap[e.key.toLowerCase()]);
      }
    });
  }
  
}
