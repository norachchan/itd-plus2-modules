window.initBannerModule = function() {
    'use strict';

    const loadDependencies = () => {
        return new Promise((resolve) => {
            if (window.Cropper) return resolve();
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.css';
            document.head.appendChild(link);
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.5.13/cropper.min.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    };

    let isUploading = false;
    let cropperInstance = null;
    let currentFileType = null;
    let currentMode = 'draw'; // 'draw', 'upload', 'html'

    const styles = `
        .drawing-modal .drawing-header h2,
        .drawing-modal .drawing-header .drawing-title,
        .drawing-modal .drawing-header > div:not(.itd-tab-container):not(.drawing-close) { 
            display: none !important; 
        }

        .drawing-header { 
            display: flex !important; 
            align-items: center !important; 
            padding: 1rem !important;
            gap: 12px !important;
        }

        .drawing-header button:last-child,
        .drawing-header .drawing-close {
            margin-left: auto !important;
        }

        .itd-tab-container { display: flex; gap: 8px; position: relative; z-index: 99; }
        .itd-tab { background: #1a1a1a; border: 1px solid #262626; border-radius: 8px; padding: .625rem 1rem; color: #ffffffb3; font-size: .875rem; font-weight: 500; cursor: pointer; transition: all .15s ease; }
        .itd-tab.active { background: #fff; color: #000; border-color: #fff; }

        .itd-upload-container { display: flex; flex-direction: column; padding: 0 24px 24px; height: 432px; box-sizing: border-box; }
        .itd-instruction { color: #ffffffb3; font-size: 14px; margin: 16px 0; }

        .itd-dropzone { 
            flex: 1; border: 2px dashed #333 !important; border-radius: 24px; 
            display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; 
            gap: 12px; cursor: pointer; transition: all 0.2s ease !important; 
            background: transparent !important; overflow: hidden; position: relative; min-height: 280px; 
        }
        .itd-dropzone:hover { border-color: #606060 !important; background: rgba(255,255,255,0.05) !important; }
        .itd-dropzone svg { color: #ffffff66 !important; stroke: currentColor !important; transition: color 0.2s ease; }
        .itd-dropzone:hover svg { color: #747474 !important; }

        .itd-dropzone img#itd-cropper-target { display: block !important; max-width: 100% !important; max-height: 280px !important; }
        .itd-overlay { z-index: 2; text-align: center; pointer-events: none; }
        .itd-text-main { font-size: 16px; font-weight: 500; color: #fff; }
        .itd-text-sub { font-size: 12px; color: #ffffff66; }
        
        .itd-html-container { display: flex; flex-direction: column; gap: 12px; height: 100%; }
        .itd-html-editor { flex: 1; display: flex; flex-direction: column; gap: 8px; }
        .itd-html-textarea { flex: 1; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 12px; color: #fff; font-family: 'Courier New', monospace; font-size: 14px; resize: none; outline: none; }
        .itd-html-textarea:focus { border-color: #606060; }
        .itd-html-preview { flex: 1; border: 1px solid #333; border-radius: 8px; padding: 12px; background: #fff; overflow: auto; min-height: 200px; }
        .itd-html-label { color: #ffffffb3; font-size: 14px; font-weight: 500; }
        
        .itd-hidden { display: none !important; }
        @keyframes itd-spin { to { transform: rotate(360deg); } }
        .itd-spinner { animation: itd-spin 0.8s linear infinite; margin-right: 10px; }
        .cropper-container { position: absolute !important; top: 0; left: 0; width: 100% !important; height: 100% !important; }
    `;

    const injectStyles = () => {
        const existing = document.getElementById('itd-styles');
        if (existing) existing.remove();
        const s = document.createElement('style');
        s.id = 'itd-styles';
        s.innerHTML = styles;
        document.head.appendChild(s);
    };

    const init = (modal) => {
        if (modal.querySelector('.itd-tab-container')) return;

        injectStyles();
        const header = modal.querySelector('.drawing-header');
        const footer = modal.querySelector('.drawing-footer');
        const saveBtn = footer.querySelector('button.drawing-btn--save');
        
        const originalUI = [
            modal.querySelector('.drawing-toolbar'), 
            modal.querySelector('.drawing-colors'), 
            modal.querySelector('.drawing-canvas-container')
        ];

        const tabs = document.createElement('div');
        tabs.className = 'itd-tab-container';
        tabs.innerHTML = `<div class="itd-tab active" id="itd-draw">Рисовать</div><div class="itd-tab" id="itd-upload">Изображение</div><div class="itd-tab" id="itd-html">HTML</div>`;
        
        header.prepend(tabs);

        const container = document.createElement('div');
        container.className = 'itd-upload-container itd-hidden';
        container.innerHTML = `
            <div class="itd-instruction">Настройте область отображения баннера. GIF загружаются без кадрирования.</div>
            <div class="itd-dropzone" id="itd-zone">
                <div class="itd-overlay" id="itd-drop-overlay">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    <div class="itd-text-main">Нажмите, чтобы выбрать изображение</div>
                    <div class="itd-text-sub">JPEG, PNG или GIF, до 20 МБ</div>
                </div>
            </div>
            <input type="file" id="itd-input" style="display:none" accept="image/*">
        `;
        modal.insertBefore(container, footer);

        const htmlContainer = document.createElement('div');
        htmlContainer.className = 'itd-upload-container itd-hidden';
        htmlContainer.innerHTML = `
            <div class="itd-instruction">Вставьте HTML код для баннера. Код будет отображаться как есть.</div>
            <div class="itd-html-container">
                <div class="itd-html-editor">
                    <label class="itd-html-label">HTML код:</label>
                    <textarea class="itd-html-textarea" id="itd-html-code" placeholder="Вставьте HTML код здесь..."></textarea>
                </div>
                <div class="itd-html-editor">
                    <label class="itd-html-label">Предпросмотр:</label>
                    <div class="itd-html-preview" id="itd-html-preview"></div>
                </div>
            </div>
        `;
        modal.insertBefore(htmlContainer, footer);

        const zone = container.querySelector('#itd-zone');
        const input = container.querySelector('#itd-input');
        const overlay = container.querySelector('#itd-drop-overlay');
        const htmlTextarea = htmlContainer.querySelector('#itd-html-code');
        const htmlPreview = htmlContainer.querySelector('#itd-html-preview');

        // Обработчик для HTML редактора
        htmlTextarea.addEventListener('input', (e) => {
            const htmlCode = e.target.value;
            htmlPreview.innerHTML = htmlCode;
        });

        const handleFileSelect = async (file) => {
            if (!file) return;
            await loadDependencies();
            currentFileType = file.type;
            const reader = new FileReader();
            reader.onload = (e) => {
                if (cropperInstance) cropperInstance.destroy();
                zone.querySelectorAll('img').forEach(i => i.remove());
                overlay.classList.add('itd-hidden');
                
                const img = document.createElement('img');
                img.id = 'itd-cropper-target';
                img.src = e.target.result;
                zone.appendChild(img);
                
                if (currentFileType !== 'image/gif') {
                    setTimeout(() => {
                        cropperInstance = new Cropper(img, {
                            aspectRatio: 16 / 5.33,
                            viewMode: 1,
                            dragMode: 'move',
                            autoCropArea: 1,
                            background: false,
                            checkOrientation: false
                        });
                    }, 50);
                }
            };
            reader.readAsDataURL(file);
        };

        zone.onclick = () => { if (!cropperInstance) input.click(); };
        input.onchange = (e) => handleFileSelect(e.target.files[0]);

        const switchMode = (mode) => {
            currentMode = mode;
            const isDraw = mode === 'draw';
            const isUpload = mode === 'upload';
            const isHtml = mode === 'html';
            
            tabs.querySelector('#itd-draw').classList.toggle('active', isDraw);
            tabs.querySelector('#itd-upload').classList.toggle('active', isUpload);
            tabs.querySelector('#itd-html').classList.toggle('active', isHtml);
            
            container.classList.toggle('itd-hidden', !isUpload);
            htmlContainer.classList.toggle('itd-hidden', !isHtml);
            
            originalUI.forEach(el => { 
                if (el) el.style.display = (isUpload || isHtml) ? 'none' : ''; 
            });
        };

        tabs.querySelector('#itd-draw').onclick = () => switchMode('draw');
        tabs.querySelector('#itd-upload').onclick = () => switchMode('upload');
        tabs.querySelector('#itd-html').onclick = () => switchMode('html');

        saveBtn.addEventListener('click', async (e) => {
            if (!container.classList.contains('itd-hidden') || !htmlContainer.classList.contains('itd-hidden')) {
                e.stopImmediatePropagation();
                e.preventDefault();
                if (isUploading) return;
                
                const uploadFinal = async (blob) => {
                    const resRefresh = await fetch('/api/v1/auth/refresh', { method: 'POST' });
                    const { accessToken } = await resRefresh.json();
                    if (!accessToken) return;

                    isUploading = true;
                    saveBtn.disabled = true;
                    saveBtn.innerHTML = 'Обработка...';

                    const fd = new FormData();
                    fd.append('file', blob, currentFileType === 'image/gif' ? "b.gif" : "b.jpg");
                    
                    try {
                        const uploadRes = await fetch('/api/files/upload', {
                            method: 'POST',
                            headers: { 'Authorization': `Bearer ${accessToken}` },
                            body: fd
                        });
                        const data = await uploadRes.json();
                        if (data.id) {
                            await fetch('/api/users/me', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                                body: JSON.stringify({ bannerId: data.id })
                            });
                            location.reload();
                        }
                    } catch (err) {
                        isUploading = false;
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = 'Сохранить';
                    }
                };

                // Обработка HTML режима
                if (currentMode === 'html') {
                    const htmlCode = htmlTextarea.value.trim();
                    if (!htmlCode) {
                        alert('Введите HTML код');
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = 'Сохранить';
                        return;
                    }

                    // Конвертируем HTML в изображение через canvas
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = htmlCode;
                    tempDiv.style.width = '1200px';
                    tempDiv.style.height = '400px';
                    tempDiv.style.position = 'absolute';
                    tempDiv.style.left = '-9999px';
                    tempDiv.style.top = '-9999px';
                    tempDiv.style.background = '#fff';
                    document.body.appendChild(tempDiv);

                    // Используем html2canvas если доступен, иначе создаем canvas вручную
                    if (window.html2canvas) {
                        html2canvas(tempDiv, { width: 1200, height: 400 }).then(canvas => {
                            canvas.toBlob(uploadFinal, 'image/jpeg', 0.9);
                            document.body.removeChild(tempDiv);
                        });
                    } else {
                        // Простой способ: создаем canvas и рисуем содержимое
                        const canvas = document.createElement('canvas');
                        canvas.width = 1200;
                        canvas.height = 400;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#fff';
                        ctx.fillRect(0, 0, 1200, 400);
                        
                        // Пробуем загрузить html2canvas динамически
                        const script = document.createElement('script');
                        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
                        script.onload = () => {
                            html2canvas(tempDiv, { width: 1200, height: 400 }).then(canvas => {
                                canvas.toBlob(uploadFinal, 'image/jpeg', 0.9);
                                document.body.removeChild(tempDiv);
                            });
                        };
                        script.onerror = () => {
                            alert('Ошибка: библиотека html2canvas не загружена. HTML будет сохранен как текст.');
                            document.body.removeChild(tempDiv);
                            saveBtn.disabled = false;
                            saveBtn.innerHTML = 'Сохранить';
                        };
                        document.head.appendChild(script);
                    }
                    return;
                }

                // Обработка режима загрузки изображения
                if (cropperInstance) {
                    cropperInstance.getCroppedCanvas({ width: 1200 }).toBlob(uploadFinal, 'image/jpeg', 0.9);
                } else if (input.files[0]) {
                    uploadFinal(input.files[0]);
                }
            }
        }, true);
    };

    const observer = new MutationObserver(() => {
        const m = document.querySelector('.drawing-modal');
        if (m) init(m);
    });
    observer.observe(document.body, { childList: true, subtree: true });
};
