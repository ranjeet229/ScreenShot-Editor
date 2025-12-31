class ScreenshotEditor {
      constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.dropZone = document.getElementById('dropZone');
        this.toolbar = document.getElementById('toolbar');
        this.canvasContainer = document.getElementById('canvasContainer');
        
        this.currentTool = 'blur';
        this.brushSize = 30;
        this.color = '#ff0000';
        this.isDrawing = false;
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        
        this.undoStack = [];
        this.redoStack = [];
        this.maxStackSize = 50;
        
        this.originalImage = null;
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d', { willReadFrequently: true });
        
        this.init();
      }

      init() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
      }

      setupEventListeners() {
        document.addEventListener('paste', (e) => this.handlePaste(e));
        this.dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.dropZone.addEventListener('drop', (e) => this.handleDrop(e));
        
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        document.querySelectorAll('[data-tool]').forEach(btn => {
          btn.addEventListener('click', (e) => this.selectTool(e.target.closest('[data-tool]').dataset.tool));
        });
        
        document.getElementById('brushSize').addEventListener('input', (e) => {
          this.brushSize = parseInt(e.target.value);
          document.getElementById('sizeValue').textContent = this.brushSize;
        });
        
        document.getElementById('colorPicker').addEventListener('input', (e) => {
          this.color = e.target.value;
        });
        
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());
        document.getElementById('copyBtn').addEventListener('click', () => this.copyToClipboard());
        document.getElementById('downloadBtn').addEventListener('click', () => this.downloadImage());
        document.getElementById('newBtn').addEventListener('click', () => this.loadNewImage());
      }

      setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
          if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
              e.preventDefault();
              this.undo();
            } else if (e.key === 'y' || (e.shiftKey && e.key === 'z')) {
              e.preventDefault();
              this.redo();
            }
          }
          
          const toolMap = { b: 'blur', p: 'pixelate', r: 'rectangle', a: 'arrow', t: 'text' };
          if (toolMap[e.key.toLowerCase()] && !e.ctrlKey && !e.metaKey) {
            this.selectTool(toolMap[e.key.toLowerCase()]);
          }
        });
      }

      selectTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('[data-tool]').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tool="${tool}"]`).classList.add('active');
      }

      handlePaste(e) {
        e.preventDefault();
        const items = e.clipboardData.items;
        
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const blob = items[i].getAsFile();
            this.loadImageFromBlob(blob);
            return;
          }
        }
      }

      handleDragOver(e) {
        e.preventDefault();
        this.dropZone.classList.add('drag-over');
      }

      handleDragLeave(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
      }

      handleDrop(e) {
        e.preventDefault();
        this.dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
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
        
        this.dropZone.classList.add('hidden');
        this.canvas.classList.remove('hidden');
        this.toolbar.classList.remove('hidden');
      }

      getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return {
          x: (e.clientX - rect.left) * scaleX,
          y: (e.clientY - rect.top) * scaleY
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

      draw(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getMousePos(e);
        this.currentX = pos.x;
        this.currentY = pos.y;
        
        if (this.currentTool === 'blur' || this.currentTool === 'pixelate') {
          this.applyBrushEffect(pos.x, pos.y);
        } else if (this.currentTool === 'rectangle' || this.currentTool === 'arrow') {
          this.drawPreview();
        }
      }

      stopDrawing() {
        if (!this.isDrawing) return;
        this.isDrawing = false;
        
        if (this.currentTool === 'rectangle') {
          this.drawRectangle();
        } else if (this.currentTool === 'arrow') {
          this.drawArrow();
        }
        
        this.saveState();
      }

      applyBrushEffect(x, y) {
        const radius = this.brushSize / 2;
        const imageData = this.tempCtx.getImageData(
          Math.max(0, x - radius),
          Math.max(0, y - radius),
          Math.min(this.canvas.width, radius * 2),
          Math.min(this.canvas.height, radius * 2)
        );
        
        if (this.currentTool === 'blur') {
          this.applyBlur(imageData);
        } else if (this.currentTool === 'pixelate') {
          this.applyPixelate(imageData);
        }
        
        this.ctx.putImageData(imageData, Math.max(0, x - radius), Math.max(0, y - radius));
      }

      applyBlur(imageData) {
        const pixels = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const blurRadius = 3;
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let r = 0, g = 0, b = 0, count = 0;
            
            for (let ky = -blurRadius; ky <= blurRadius; ky++) {
              for (let kx = -blurRadius; kx <= blurRadius; kx++) {
                const px = x + kx;
                const py = y + ky;
                
                if (px >= 0 && px < width && py >= 0 && py < height) {
                  const idx = (py * width + px) * 4;
                  r += pixels[idx];
                  g += pixels[idx + 1];
                  b += pixels[idx + 2];
                  count++;
                }
              }
            }
            
            const idx = (y * width + x) * 4;
            pixels[idx] = r / count;
            pixels[idx + 1] = g / count;
            pixels[idx + 2] = b / count;
          }
        }
      }

      applyPixelate(imageData) {
        const pixels = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        const blockSize = 10;
        
        for (let y = 0; y < height; y += blockSize) {
          for (let x = 0; x < width; x += blockSize) {
            let r = 0, g = 0, b = 0, count = 0;
            
            for (let by = 0; by < blockSize && y + by < height; by++) {
              for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
                const idx = ((y + by) * width + (x + bx)) * 4;
                r += pixels[idx];
                g += pixels[idx + 1];
                b += pixels[idx + 2];
                count++;
              }
            }
            
            r = Math.floor(r / count);
            g = Math.floor(g / count);
            b = Math.floor(b / count);
            
            for (let by = 0; by < blockSize && y + by < height; by++) {
              for (let bx = 0; bx < blockSize && x + bx < width; bx++) {
                const idx = ((y + by) * width + (x + bx)) * 4;
                pixels[idx] = r;
                pixels[idx + 1] = g;
                pixels[idx + 2] = b;
              }
            }
          }
        }
      }

      drawPreview() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(this.tempCanvas, 0, 0);
        
        if (this.currentTool === 'rectangle') {
          this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          this.ctx.fillRect(
            this.startX,
            this.startY,
            this.currentX - this.startX,
            this.currentY - this.startY
          );
        } else if (this.currentTool === 'arrow') {
          this.ctx.strokeStyle = this.color;
          this.ctx.fillStyle = this.color;
          this.ctx.lineWidth = 3;
          this.drawArrowShape(this.startX, this.startY, this.currentX, this.currentY);
        }
      }

      drawRectangle() {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(
          this.startX,
          this.startY,
          this.currentX - this.startX,
          this.currentY - this.startY
        );
      }

      drawArrow() {
        this.ctx.strokeStyle = this.color;
        this.ctx.fillStyle = this.color;
        this.ctx.lineWidth = 3;
        this.drawArrowShape(this.startX, this.startY, this.currentX, this.currentY);
      }

      drawArrowShape(x1, y1, x2, y2) {
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const headLen = 20;
        
        this.ctx.beginPath();
        this.ctx.moveTo(x1, y1);
        this.ctx.lineTo(x2, y2);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(x2, y2);
        this.ctx.lineTo(
          x2 - headLen * Math.cos(angle - Math.PI / 6),
          y2 - headLen * Math.sin(angle - Math.PI / 6)
        );
        this.ctx.lineTo(
          x2 - headLen * Math.cos(angle + Math.PI / 6),
          y2 - headLen * Math.sin(angle + Math.PI / 6)
        );
        this.ctx.closePath();
        this.ctx.fill();
      }

      addText(x, y) {
        const text = prompt('Enter text:');
        if (text) {
          this.ctx.font = `${this.brushSize}px Arial`;
          this.ctx.fillStyle = this.color;
          this.ctx.fillText(text, x, y);
          this.saveState();
        }
        this.isDrawing = false;
      }

      saveState() {
        if (this.undoStack.length >= this.maxStackSize) {
          this.undoStack.shift();
        }
        
        this.undoStack.push(this.canvas.toDataURL());
        this.redoStack = [];
        this.updateUndoRedoButtons();
      }

      undo() {
        if (this.undoStack.length <= 1) return;
        
        const currentState = this.undoStack.pop();
        this.redoStack.push(currentState);
        
        const previousState = this.undoStack[this.undoStack.length - 1];
        this.restoreState(previousState);
        this.updateUndoRedoButtons();
      }

      redo() {
        if (this.redoStack.length === 0) return;
        
        const state = this.redoStack.pop();
        this.undoStack.push(state);
        this.restoreState(state);
        this.updateUndoRedoButtons();
      }

      restoreState(dataUrl) {
        const img = new Image();
        img.onload = () => {
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          this.ctx.drawImage(img, 0, 0);
        };
        img.src = dataUrl;
      }

      updateUndoRedoButtons() {
        document.getElementById('undoBtn').disabled = this.undoStack.length <= 1;
        document.getElementById('redoBtn').disabled = this.redoStack.length === 0;
      }

      async copyToClipboard() {
        try {
          this.canvas.toBlob(async (blob) => {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            this.showNotification('✓ Copied to clipboard!');
          });
        } catch (err) {
          this.showNotification('✗ Failed to copy. Try downloading instead.');
        }
      }

      downloadImage() {
        const link = document.createElement('a');
        link.download = `screenshot-${Date.now()}.png`;
        link.href = this.canvas.toDataURL();
        link.click();
        this.showNotification('✓ Downloaded!');
      }

      loadNewImage() {
        if (confirm('Load a new image? Current edits will be lost.')) {
          this.canvas.classList.add('hidden');
          this.toolbar.classList.add('hidden');
          this.dropZone.classList.remove('hidden');
          this.undoStack = [];
          this.redoStack = [];
        }
      }

      showNotification(message) {
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #333;
          color: white;
          padding: 16px 24px;
          border-radius: 8px;
          font-weight: 500;
          z-index: 1000;
          animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.style.animation = 'slideOut 0.3s ease';
          setTimeout(() => notification.remove(), 300);
        }, 2000);
      }
    }

    const editor = new ScreenshotEditor();