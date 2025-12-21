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
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z") {
          e.preventDefault();
          this.undo();
        } else if (e.key === "y" || (e.shiftKey && e.key === "z")) {
          e.preventDefault();
          this.redo();
        }
      }

      const toolMap = {
        b: "blur",
        p: "pixelate",
        r: "rectangle",
        a: "arrow",
        t: "text",
      };
      if (toolMap[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
        this.selectTool(toolMap[e.key.toLowerCase()]);
      }
    });
  }
  selectTool(tool) {
    this.currentTool = tool;
    document
      .querySelectorAll("[data-tool]")
      .forEach((btn) => btn.classList.remove("active"));
    document.querySelector(`[data-tool="${tool}"]`).classList.add("active");
  }
  handlePaste(e) {
    e.preventDefault();
    const items = e.clipboardData.items;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        this.loadImageFromBlob(blob);
        return;
      }
    }
  }
  handleDragOver(e) {
    e.preventDefault();
    this.dropZone.classList.add("drag-over");
  }
  handleDragLeave(e) {
    e.preventDefault();
    this.dropZone.classList.remove("drag-over");
  }
  handleDrop(e) {
    e.preventDefault();
    this.dropZone.classList.remove("drag-over");

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith("image/")) {
      this.loadImageFromBlob(files[0]);
    }
  }
  loadImageFromBlob(blob) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        this.originalImage = img;
        this.setupCanvas(img);
        this.saveState();
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(blob);
  }

  setupCanvas(img) {
    this.canvas.width = img.width;
    this.canvas.height = img.height;
    this.tempCanvas.width = img.width;
    this.tempCanvas.height = img.height;

    this.ctx.drawImage(img, 0, 0);

    this.dropZone.classList.add("hidden");
    this.canvas.classList.remove("hidden");
    this.canvas.classList.remove("hidden");
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  startDrawing(e) {
    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.startX = pos.x;
    this.startY = pos.y;
    this.currentX = pos.x;
    this.currentY = pos.y;

    this.tempCtx.clearRect(0, 0, this.tempCanvas.width, this.tempCanvas.height);
    this.tempCtx.drawImage(this.canvas, 0, 0);

    if (this.currentTool === 'blur' || this.currentTool === 'pixelate') {
      this.applyBrushEffect(pos.x, pos.y);
    } else if (this.currentTool === 'text') {
      this.addText(pos.x, pos.y);
    }
  }

  draw(e){
    if(!this.isDrawing ) return ;

    const pos = this.getMousePos(e);
    this.currentX =  pos.x;
    this.currentY = pos.y;

    if(this.currentTool === 'blur' || this.currentTool === 'pixelate'){
      this.applyBrushEffect(pos.x, pos.y);
    }else if(this.currentTool === 'rectangle' || this.currentTool === 'arrow'){
      this.drawPreview();
    }
  }

  stopDrawing(){
    if(!this.isDrawing) return ;
    this.isDrawing = false;

    if(this.currentTool === 'rectangle'){
      this.drawRectangle();
    }else if(this.currentTool === 'arrow'){
      this.drawArrow();
    }
    this.saveState();
  }
  applyBrushEffect(x, y){
    const radius = this.brushSize /2;
    const imageData = this.tempCtx.getImageData(
      Math.max(0, x - radius),
      Math.max(0, y - radius),
      Math.min(this.canvas.width, radius*2),
      Math.min(this.canvas.height, radius*2)
    );

    if(this.currentTool ==='blur'){
      this.applyBlur(imageData);
    }else if(this.currentTool === 'pixelate'){
      this.applyPixelate(imageData);
    }
    this.ctx.putImageData(imageData, Math.max(0, x - radius), Math.max(0, y - radius));
  }
  
}
