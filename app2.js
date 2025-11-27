// Envolve toda a lógica em um objeto para evitar poluir o escopo global.
const TaskTrackerApp = {
    // 1. STATE
    state: {
        tasks: [],
        projects: [],
        extraColumns: [],
        activeTaskId: null,
        intervalId: null,
        currentProject: "", // "" = todas as tarefas
        sidebarOpen: false,
    },

    // 2. CONSTANTS
    constants: {
        STORAGE_KEY_TASKS: "task_tracker_v4",
        STORAGE_KEY_PROJECTS: "task_tracker_projects",
        STORAGE_KEY_COLUMNS: "extra_columns",
        STORAGE_KEY_DARK_MODE: "dark_mode",
        STORAGE_KEY_SIDEBAR: "sidebar_open",
        POMODORO_DURATION_SECONDS: 25 * 60,
        CHECK_STATES: [' ', '✓', '–', '✕'],
    },

    // 3. DOM ELEMENTS
    dom: {
        // Sidebar
        sidebar: document.getElementById("sidebar"),
        sidebarToggle: document.getElementById("sidebarToggle"),
        projectsList: document.getElementById("projectsList"),
        addProjectBtn: document.getElementById("addProjectBtn"),
        sidebarDarkMode: document.getElementById("sidebarDarkMode"),
        
        // Main
        mainContent: document.getElementById("mainContent"),
        currentProjectTitle: document.getElementById("currentProjectTitle"),
        
        // Tables
        taskTableBody: document.getElementById("taskTable"),
        completedTableBody: document.getElementById("completedTable"),
        tableHead: document.getElementById("tableHead"),
        completedHead: document.getElementById("completedHead"),
        activitiesTableBody: document.getElementById("activitiesTable"),

        // Buttons
        addTaskButton: document.getElementById("addTask"),
        manageColumnsButton: document.getElementById("manageColumns"),
        addColumnButton: document.getElementById("addColumn"),
        showCompletedButton: document.getElementById("showCompleted"),
        confirmAddProject: document.getElementById("confirmAddProject"),

        // Modals
        columnsModal: null,
        completedCanvas: null,
        activitiesModal: null,
        projectModal: null,

        // Inputs
        newColumnNameInput: document.getElementById("newColumnName"),
        newProjectNameInput: document.getElementById("newProjectName"),

        // Media
        tickAudio: document.getElementById("tickAudio"),
        pipVideo: document.getElementById('pip-timer'),
    },

    // 4. PiP TIMER
    pip: {
        canvas: null,
        ctx: null,
        initialized: false,

        init() {
            if (this.initialized) return;
            this.canvas = document.createElement('canvas');
            this.canvas.width = 120;
            this.canvas.height = 60;
            this.ctx = this.canvas.getContext('2d');
            this.initialized = true;
        },

        _connectStream() {
            if (!this.initialized) this.init();
            if (!TaskTrackerApp.dom.pipVideo.srcObject) {
                const stream = this.canvas.captureStream();
                TaskTrackerApp.dom.pipVideo.srcObject = stream;
            }
        },

        updateDisplay(text) {
            if (!this.ctx) return;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--back-color').trim() || 'white';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--front-color').trim() || 'black';
            this.ctx.font = '24px "JetBrains Mono", monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
        },

        async show() {
            if (!document.pictureInPictureEnabled || document.pictureInPictureElement) return;
            this._connectStream();
            try {
                await TaskTrackerApp.dom.pipVideo.play();
                await TaskTrackerApp.dom.pipVideo.requestPictureInPicture();
            } catch (err) {
                console.warn("Falha ao iniciar o Picture-in-Picture:", err);
            }
        },

        async hide() {
            if (document.pictureInPictureElement) {
                try {
                    await document.exitPictureInPicture();
                } catch (err) {
                    console.warn("Falha ao fechar o Picture-in-Picture:", err);
                }
            }
        }
    },

    // 5. INIT
    init() {
        // Inicializa modais depois do DOM
        this.dom.columnsModal = new bootstrap.Modal("#columnsModal");
        this.dom.completedCanvas = new bootstrap.Offcanvas("#completedCanvas");
        this.dom.activitiesModal = new bootstrap.Modal("#activitiesModal");
        this.dom.projectModal = new bootstrap.Modal("#projectModal");
        
        this._loadState();
        this._bindEvents();
        this._applyInitialTheme();
        this._applySidebarState();
        this.render();
    },

    _loadState() {
        this.state.tasks = JSON.parse(localStorage.getItem(this.constants.STORAGE_KEY_TASKS) || "[]");
        this.state.projects = JSON.parse(localStorage.getItem(this.constants.STORAGE_KEY_PROJECTS) || "[]");
        this.state.extraColumns = JSON.parse(localStorage.getItem(this.constants.STORAGE_KEY_COLUMNS) || "[]");
        this.state.sidebarOpen = localStorage.getItem(this.constants.STORAGE_KEY_SIDEBAR) === '1';
    },

    _saveState() {
        localStorage.setItem(this.constants.STORAGE_KEY_TASKS, JSON.stringify(this.state.tasks));
        localStorage.setItem(this.constants.STORAGE_KEY_PROJECTS, JSON.stringify(this.state.projects));
        localStorage.setItem(this.constants.STORAGE_KEY_COLUMNS, JSON.stringify(this.state.extraColumns));
    },

    _bindEvents() {
        // Sidebar
        this.dom.sidebarToggle.addEventListener('click', this.toggleSidebar.bind(this));
        this.dom.addProjectBtn.addEventListener('click', () => this.dom.projectModal.show());
        this.dom.sidebarDarkMode.addEventListener('click', this._handleThemeSwitch.bind(this));
        this.dom.sidebar.addEventListener('click', this._handleSidebarClick.bind(this));
        this.dom.confirmAddProject.addEventListener('click', this.addProject.bind(this));
        
        // Enter no input de projeto
        this.dom.newProjectNameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.addProject();
        });

        // Table events
        this.dom.taskTableBody.addEventListener('click', this._handleTableClick.bind(this));
        this.dom.taskTableBody.addEventListener('click', this._handleCheckToggle.bind(this));
        document.addEventListener('click', this._handleDocumentClick.bind(this));
        document.addEventListener("paste", this._handlePaste.bind(this));

        // Header buttons
        this.dom.addTaskButton.addEventListener('click', this.addTask.bind(this));
        this.dom.manageColumnsButton.addEventListener('click', () => this.dom.columnsModal.show());
        this.dom.addColumnButton.addEventListener('click', this.addColumn.bind(this));
        this.dom.showCompletedButton.addEventListener('click', this.showCompleted.bind(this));

        // Edit events
        this.dom.taskTableBody.addEventListener('focusout', this._handleCellBlur.bind(this));
        this.dom.activitiesTableBody.addEventListener('input', this._handleActivityDescInput.bind(this));
        this.dom.taskTableBody.addEventListener('keydown', this._handleCellKeydown.bind(this));
    },

    _applyInitialTheme() {
        const isDark = localStorage.getItem(this.constants.STORAGE_KEY_DARK_MODE) === '1';
        document.body.classList.toggle("dark", isDark);
        this._updateDarkModeIcon();
    },

    _applySidebarState() {
        if (this.state.sidebarOpen) {
            this.dom.sidebar.classList.add('open');
        }
    },

    _updateDarkModeIcon() {
        const isDark = document.body.classList.contains('dark');
        const icon = this.dom.sidebarDarkMode.querySelector('i');
        icon.className = isDark ? 'bi bi-sun' : 'bi bi-moon';
    },

    // 6. SIDEBAR
    toggleSidebar() {
        this.state.sidebarOpen = !this.state.sidebarOpen;
        this.dom.sidebar.classList.toggle('open', this.state.sidebarOpen);
        localStorage.setItem(this.constants.STORAGE_KEY_SIDEBAR, this.state.sidebarOpen ? '1' : '0');
    },

    _handleSidebarClick(e) {
        // "Todas as Tarefas"
        const allTasksBtn = e.target.closest('.sidebar-item[data-project]');
        if (allTasksBtn && allTasksBtn.dataset.project === '') {
            this.selectProject('');
            return;
        }

        // Projeto específico
        const projectBtn = e.target.closest('.sidebar-project');
        if (projectBtn && !e.target.closest('.sidebar-project-delete')) {
            const projectName = projectBtn.dataset.project;
            this.selectProject(projectName);
            return;
        }

        // Deletar projeto
        const deleteBtn = e.target.closest('.sidebar-project-delete');
        if (deleteBtn) {
            const projectName = deleteBtn.dataset.project;
            this.deleteProject(projectName);
        }
    },

    selectProject(projectName) {
        this.state.currentProject = projectName;
        
        // Atualiza título
        // this.dom.currentProjectTitle.textContent = projectName || 'Todas as Tarefas';
        this.dom.currentProjectTitle.textContent = '25m.in';
        
        // Toggle classe no body para esconder coluna projeto
        document.body.classList.toggle('in-project', projectName !== '');
        
        this.render();
        this._renderProjectsList();
    },

    addProject() {
        const name = this.dom.newProjectNameInput.value.trim();
        if (!name) return;
        
        if (!this.state.projects.includes(name)) {
            this.state.projects.push(name);
            this._saveState();
            this._renderProjectsList();
        }
        
        this.dom.newProjectNameInput.value = '';
        this.dom.projectModal.hide();
        
        // Seleciona o novo projeto
        this.selectProject(name);
    },

    deleteProject(projectName) {
        if (!confirm(`Deletar projeto "${projectName}"? As tarefas não serão excluídas.`)) return;
        
        this.state.projects = this.state.projects.filter(p => p !== projectName);
        this._saveState();
        
        // Se estava no projeto deletado, volta pra "Todas"
        if (this.state.currentProject === projectName) {
            this.selectProject('');
        } else {
            this._renderProjectsList();
        }
    },

    _renderProjectsList() {
        // Combina projetos salvos com projetos das tarefas
        const taskProjects = [...new Set(this.state.tasks.map(t => t.task_label).filter(Boolean))];
        const allProjects = [...new Set([...this.state.projects, ...taskProjects])].sort();
        
        this.dom.projectsList.innerHTML = allProjects.map(p => `
            <label class="sidebar-project ${p === this.state.currentProject ? 'active' : ''}" data-project="${this.utils.escapeHtml(p)}">
                <button style="background: transparent;border:0;outline: 0;overflow: hidden;z-index: 3;color:inherit;" class="sidebar-project-name">
                    <i class="bi bi-folder"></i>
                    <span>${this.utils.escapeHtml(p)}</span>
                </button>
                <button class="sidebar-project-delete" data-project="${this.utils.escapeHtml(p)}">
                    <i class="bi bi-x"></i>
                </button>
            </label>
        `).join('');
        
        // Atualiza "Todas as Tarefas" active state
        const allTasksBtn = this.dom.sidebar.querySelector('.sidebar-item[data-project=""]');
        if (allTasksBtn) {
            allTasksBtn.classList.toggle('active', this.state.currentProject === '');
        }
    },

    // 7. RENDER
    render() {
        this._renderTable(this.dom.taskTableBody, this.dom.tableHead, false);
        this._renderProjectsList();
    },

    _renderTable(tbody, thead, onlyDone) {
        tbody.innerHTML = "";
        thead.innerHTML = "";

        let filteredTasks = this.state.tasks.filter(t => onlyDone ? t.checked : !t.checked);
        
        // Filtra por projeto se necessário
        if (this.state.currentProject) {
            filteredTasks = filteredTasks.filter(t => (t.task_label || "") === this.state.currentProject);
        }

        this._renderHead(thead);

        filteredTasks.forEach(task => {
            const tr = this._createTaskRow(task);
            tbody.appendChild(tr);
        });
    },

    _renderHead(headElement) {
        const baseColumns = [
            {key: "check", label: "✔", fit: "50px"},
            {key: "task_desc", label: "Tarefa"},
            {key: "task_label", label: "Projeto", fit: "200px", class: "col-project"},
            {key: "total", label: "Total", fit: "120px"},
            // {key: "timer", label: "Timer", fit: "120px"},
            {key: "actions", label: "Ações", fit: "120px"}
        ];

        const allColumns = [...baseColumns];
        
        // Insere colunas extras antes de "actions"
        const actionsIndex = allColumns.findIndex(c => c.key === 'actions');
        this.state.extraColumns.forEach((col, i) => {
            allColumns.splice(actionsIndex + i, 0, col);
        });

        allColumns.forEach(col => {
            const th = document.createElement("th");
            if (col.fit) th.style.width = col.fit;
            if (col.class) th.className = col.class;
            th.textContent = col.label || '';
            headElement.appendChild(th);
        });
    },

    _createTaskRow(task) {
        const tr = document.createElement("tr");
        tr.dataset.taskId = task.task_id;
        if (task.task_id === this.state.activeTaskId) tr.classList.add("playing");
        if (task.checked) tr.classList.add("done");

        const totalTime = this.utils.calcTotalTime(task.task_activity);
        const descHtml = this.utils.renderListOrText(task.task_desc || "");
        const isPlaying = this.state.activeTaskId === task.task_id;
        const playButtonIcon = isPlaying ? "bi-stop-fill" : "bi-play-fill";
        const playButtonAction = isPlaying ? "stop" : "play";

        tr.innerHTML = `
            <td><input type="checkbox" ${task.checked ? "checked" : ""} data-action="toggle" data-id="${task.task_id}"></td>
            <td contenteditable="true" spellcheck="false" data-field="task_desc">${descHtml}</td>
            <td class="col-project" contenteditable="false" spellcheck="false" data-field="task_label">${this.utils.escapeHtml(task.task_label || "")}</td>
            <td><span class="total" data-id="${task.task_id}">${this.utils.formatTime(totalTime)}</span></td>
<!--            <td><span class="timer" data-id="${task.task_id}">00:00:00</span></td>-->
            <td>
                <button class="btn btn-sm" data-action="${playButtonAction}" data-id="${task.task_id}"><i class="bi ${playButtonIcon}"></i></button>
                <button class="btn btn-sm" data-action="delete" data-id="${task.task_id}"><i class="bi bi-trash"></i></button>
            </td>
        `;

        // Colunas extras - inserir antes das ações
        const actionsCell = tr.lastElementChild;
        this.state.extraColumns.forEach(col => {
            const val = (task.extra && task.extra[col.key]) || "";
            const td = document.createElement('td');
            td.contentEditable = true;
            td.spellcheck = false;
            td.dataset.extra = col.key;
            td.textContent = val;
            tr.insertBefore(td, actionsCell);
        });

        return tr;
    },

    _renderActivities(taskId) {
        const task = this.state.tasks.find(t => t.task_id === taskId);
        this.dom.activitiesTableBody.innerHTML = "";
        (task?.task_activity || []).forEach((act, idx) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${act.start ? new Date(act.start).toLocaleString() : ""}</td>
                <td>${act.end ? new Date(act.end).toLocaleString() : ""}</td>
                <td>${this.utils.formatTime(act.total || 0)}</td>
                <td contenteditable="true" data-task-id="${taskId}" data-activity-idx="${idx}">${this.utils.escapeHtml(act.desc || "")}</td>
            `;
            this.dom.activitiesTableBody.appendChild(tr);
        });
    },

    // 8. ACTIONS
    addTask() {
        this.state.tasks.unshift({
            task_id: Date.now(),
            task_desc: "",
            task_label: this.state.currentProject, // Já coloca no projeto atual
            task_activity: [],
            checked: false,
            extra: {}
        });
        this._saveState();
        this.render();

        const firstRow = this.dom.taskTableBody.querySelector('tr');
        if (firstRow) {
            const descCell = firstRow.querySelector('[data-field="task_desc"]');
            if (descCell) descCell.focus();
        }
    },

    deleteTask(taskId) {
        if (this.state.activeTaskId === taskId) {
            this.stopTimer();
        }
        this.state.tasks = this.state.tasks.filter(t => t.task_id !== taskId);
        this._saveState();
        this.render();
    },

    toggleTaskStatus(taskId) {
        const task = this.state.tasks.find(t => t.task_id === taskId);
        if (task) {
            task.checked = !task.checked;
            this._saveState();
            this.render();
        }
    },

    addColumn() {
        const name = this.dom.newColumnNameInput.value.trim();
        if (!name) return;

        this.state.extraColumns.push({ key: `col_${Date.now()}`, label: name });
        this.dom.newColumnNameInput.value = "";
        this._saveState();
        this.render();
    },

    showCompleted() {
        this._renderTable(this.dom.completedTableBody, this.dom.completedHead, true);
        this.dom.completedCanvas.show();
    },

    startTimer(taskId) {
        if (this.state.activeTaskId) {
            this.stopTimer();
        }

        this.state.activeTaskId = taskId;
        const task = this.state.tasks.find(t => t.task_id === taskId);
        task.task_activity.push({ start: Date.now(), end: null, total: 0 });
        this._saveState();

        this.pip.show();
        this.dom.tickAudio.loop = true;
        this.dom.tickAudio.play().catch(() => {});

        // Render primeiro para atualizar o botão play/stop
        this.render();

        let remaining = this.constants.POMODORO_DURATION_SECONDS;

        this.state.intervalId = setInterval(() => {
            const timerSpan = document.querySelector(`.timer[data-id="${taskId}"]`);
            const timeStr = this.utils.formatTime(remaining);
            if (timerSpan) timerSpan.textContent = timeStr;
            this.pip.updateDisplay(timeStr);
            
            if (remaining <= 0) {
                this.stopTimer();
            }
            remaining--;
        }, 1000);
    },

    stopTimer() {
        if (!this.state.activeTaskId) return;

        clearInterval(this.state.intervalId);
        this.state.intervalId = null;

        this.dom.tickAudio.pause();
        this.dom.tickAudio.currentTime = 0;
        this.pip.hide();

        const task = this.state.tasks.find(t => t.task_id === this.state.activeTaskId);
        const currentActivity = task.task_activity.at(-1);

        if (currentActivity && !currentActivity.end) {
            currentActivity.end = Date.now();
            currentActivity.total = Math.floor((currentActivity.end - currentActivity.start) / 1000);
        }

        this.state.activeTaskId = null;
        this._saveState();
        this.render();
    },

    // 9. EVENT HANDLERS
    _handleTableClick(e) {
        const target = e.target.closest("[data-action]");
        if (!target) return;

        const action = target.dataset.action;
        const id = Number(target.dataset.id);

        switch (action) {
            case 'play': this.startTimer(id); break;
            case 'stop': this.stopTimer(); break;
            case 'delete': this.deleteTask(id); break;
            case 'toggle': this.toggleTaskStatus(id); break;
        }
    },

    _handleDocumentClick(e) {
        const totalSpan = e.target.closest(".total[data-id]");
        if (totalSpan) {
            const taskId = Number(totalSpan.dataset.id);
            this._renderActivities(taskId);
            this.dom.activitiesModal.show();
        }
    },

    _handleCheckToggle(e) {
        const cell = e.target.closest('[data-field="task_desc"]');
        if (!cell) return;

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        if (node.nodeType !== Node.TEXT_NODE) return;

        const offset = range.startOffset;
        if (this._toggleCheckInNode(node, offset)) {
            this._updateLineStyle(node);

            const tr = cell.closest('tr');
            if (tr?.dataset.taskId) {
                const taskId = Number(tr.dataset.taskId);
                const task = this.state.tasks.find(t => t.task_id === taskId);
                if (task) {
                    task.task_desc = this.utils.extractPlainText(cell);
                    this._saveState();
                }
            }
        }
    },

    _toggleCheckInNode(node, offset) {
        const STATES = this.constants.CHECK_STATES;
        const text = node.nodeValue;

        const before = text.substring(0, offset);
        const after = text.substring(offset);

        const bracketStart = before.lastIndexOf('[');
        const bracketEnd = after.indexOf(']');

        if (bracketStart === -1 || bracketEnd === -1) return false;

        const charPos = bracketStart + 1;
        const currentChar = text.charAt(charPos);

        const currentIndex = STATES.indexOf(currentChar);
        if (currentIndex === -1) return false;

        const nextChar = STATES[(currentIndex + 1) % STATES.length];
        node.replaceData(charPos, 1, nextChar);

        return true;
    },

    _updateLineStyle(node) {
        let lineElement = node.parentElement;
        while (lineElement && lineElement.tagName !== 'DIV') {
            if (lineElement.tagName === 'TD') return;
            lineElement = lineElement.parentElement;
        }

        if (!lineElement) return;

        const text = lineElement.textContent;

        lineElement.classList.remove('line-done', 'line-blocked', 'line-waiting');

        if (/^\[✓\]/.test(text)) {
            lineElement.classList.add('line-done');
        } else if (/^\[✕\]/.test(text)) {
            lineElement.classList.add('line-blocked');
        } else if (/^\[–\]/.test(text)) {
            lineElement.classList.add('line-waiting');
        }
    },

    _handleCellKeydown(e) {
        if (e.key !== 'Enter') return;

        const cell = e.target.closest('[contenteditable="true"]');
        if (!cell) return;

        if (cell.dataset.field !== 'task_desc') {
            e.preventDefault();
            return;
        }

        e.preventDefault();
        document.execCommand("insertText", false, "\n[ ] ");
    },

    _handleCellBlur(e) {
        const cell = e.target.closest('[contenteditable="true"]');
        if (!cell) return;

        const tr = cell.closest('tr');
        if (!tr || !tr.dataset.taskId) return;

        const taskId = Number(tr.dataset.taskId);
        const task = this.state.tasks.find(t => t.task_id === taskId);
        if (!task) return;

        if (cell.dataset.field) {
            const field = cell.dataset.field;

            if (field === 'task_desc') {
                task[field] = this.utils.extractPlainText(cell);
            } else {
                task[field] = cell.innerText.trim();
            }
        } else if (cell.dataset.extra) {
            task.extra = task.extra || {};
            task.extra[cell.dataset.extra] = cell.innerText.trim();
        }

        this._saveState();

        // Se mudou o label, atualiza a lista de projetos
        if (cell.dataset.field === "task_label") {
            this._renderProjectsList();
        }
    },

    _handleActivityDescInput(e) {
        const cell = e.target.closest('td[contenteditable="true"]');
        if (!cell) return;

        const taskId = Number(cell.dataset.taskId);
        const activityIdx = Number(cell.dataset.activityIdx);

        const task = this.state.tasks.find(t => t.task_id === taskId);
        if (task && task.task_activity[activityIdx]) {
            task.task_activity[activityIdx].desc = cell.innerText.trim();
            this._saveState();
        }
    },

    _handleThemeSwitch() {
        const isDark = !document.body.classList.contains('dark');
        document.body.classList.toggle("dark", isDark);
        localStorage.setItem(this.constants.STORAGE_KEY_DARK_MODE, isDark ? '1' : '0');
        this._updateDarkModeIcon();
    },

    _handlePaste(e) {
        const target = e.target;
        if (!target.isContentEditable) return;

        e.preventDefault();
        let text = (e.clipboardData || window.clipboardData).getData("text/plain");

        const lines = text.split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);

        let result;
        if (lines.length > 1) {
            result = lines.map(l => `[ ] ${l}`).join('\n');
        } else {
            result = lines[0] || '';
        }

        document.execCommand("insertText", false, result);
    },

    // 10. UTILS
    utils: {
        formatTime(totalSeconds) {
            const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
            const m = String(Math.floor(totalSeconds % 3600 / 60)).padStart(2, "0");
            const s = String(totalSeconds % 60).padStart(2, "0");
            return `${h}:${m}:${s}`;
        },

        calcTotalTime(activities) {
            return (activities || []).reduce((sum, act) => sum + (act.total || 0), 0);
        },

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        },

        extractPlainText(element) {
            const clone = element.cloneNode(true);

            clone.querySelectorAll('br').forEach(br => {
                br.replaceWith('\n');
            });

            const blockElements = clone.querySelectorAll('div, p, li, span');
            blockElements.forEach(el => {
                const text = el.textContent;
                if (text) {
                    el.replaceWith(text + '\n');
                }
            });

            return clone.textContent
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        },

        renderListOrText(text) {
            if (!text || !text.trim()) return '';

            const lines = text.split(/\r?\n/);

            return lines.map(line => {
                const escaped = this.escapeHtml(line);

                if (/^\[✓\]/.test(line)) {
                    return `<div class="line-done">${escaped}</div>`;
                } else if (/^\[✕\]/.test(line)) {
                    return `<div class="line-blocked">${escaped}</div>`;
                } else if (/^\[–\]/.test(line)) {
                    return `<div class="line-waiting">${escaped}</div>`;
                }
                return `<div>${escaped}</div>`;
            }).join('');
        }
    }
};

// Init
document.addEventListener('DOMContentLoaded', () => TaskTrackerApp.init());
