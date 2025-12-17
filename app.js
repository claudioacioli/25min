const TaskTrackerApp = {
    state: {
        tasks: [],
        projects: [],
        extraColumns: [],
        activeTaskId: null,
        activeTimerMode: null,
        intervalId: null,
        currentProject: "",
        sidebarOpen: false,
        activeActivityTaskId: null,
        settings: {
            timerButtons: [15, 25, 45],
            enableSound: true,
            volume: 50
        },
        pendingActivityDesc: null
    },

    constants: {
        STORAGE_KEY_TASKS: "task_tracker_v4",
        STORAGE_KEY_PROJECTS: "task_tracker_projects",
        STORAGE_KEY_COLUMNS: "extra_columns",
        STORAGE_KEY_DARK_MODE: "dark_mode",
        STORAGE_KEY_SIDEBAR: "sidebar_open",
        STORAGE_KEY_SETTINGS: "task_tracker_settings",
        CHECK_STATES: [' ', '✓', '—', '✕']
    },

    dom: {
        sidebar: document.getElementById("sidebar"),
        sidebarToggle: document.getElementById("sidebarToggle"),
        projectsList: document.getElementById("projectsList"),
        addProjectBtn: document.getElementById("addProjectBtn"),
        sidebarDarkMode: document.getElementById("sidebarDarkMode"),
        sidebarSettings: document.getElementById("sidebarSettings"),
        mainContent: document.getElementById("mainContent"),
        homeView: document.getElementById("homeView"),
        projectView: document.getElementById("projectView"),
        projectsGrid: document.getElementById("projectsGrid"),
        homeAddProject: document.getElementById("homeAddProject"),
        currentProjectName: document.getElementById("currentProjectName"),
        tasksPanel: document.getElementById("tasksPanel"),
        activitiesPanel: document.getElementById("activitiesPanel"),
        activitiesTitle: document.getElementById("activitiesTitle"),
        closeActivities: document.getElementById("closeActivities"),
        taskTableBody: document.getElementById("taskTable"),
        completedTableBody: document.getElementById("completedTable"),
        tableHead: document.getElementById("tableHead"),
        completedHead: document.getElementById("completedHead"),
        activitiesTableBody: document.getElementById("activitiesTable"),
        addTaskButton: document.getElementById("addTask"),
        showCompletedButton: document.getElementById("showCompleted"),
        confirmAddProject: document.getElementById("confirmAddProject"),
        completedCanvas: null,
        projectModal: null,
        settingsModal: null,
        activityDescModal: null,
        themeSelect: document.getElementById("themeSelect"),
        settingsTitle: document.getElementById("settingsTitle"),
        newProjectNameInput: document.getElementById("newProjectName"),
        timerBtn1Input: document.getElementById("timerBtn1"),
        timerBtn2Input: document.getElementById("timerBtn2"),
        timerBtn3Input: document.getElementById("timerBtn3"),
        enableSoundCheckbox: document.getElementById("enableSound"),
        volumeControl: document.getElementById("volumeRow"),
        volumeSlider: document.getElementById("volumeSlider"),
        volumeValue: document.getElementById("volumeValue"),
        activityTimeSpent: document.getElementById("activityTimeSpent"),
        activityTaskName: document.getElementById("activityTaskName"),
        activityDescription: document.getElementById("activityDescription"),
        skipActivityDescBtn: document.getElementById("skipActivityDesc"),
        saveActivityDescBtn: document.getElementById("saveActivityDesc"),
        tickAudio: document.getElementById("tickAudio"),
        pipVideo: document.getElementById('pip-timer'),
    },

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
            } catch (err) {}
        },
        async hide() {
            if (document.pictureInPictureElement) {
                try { await document.exitPictureInPicture(); } catch (err) {}
            }
        }
    },

    init() {
        this.dom.completedCanvas = new bootstrap.Offcanvas("#completedCanvas");
        this.dom.projectModal = new bootstrap.Modal("#projectModal");
        this.dom.settingsModal = new bootstrap.Modal("#settingsModal");
        this.dom.activityDescModal = new bootstrap.Modal("#activityDescModal");
        this._loadState();
        this._bindEvents();
        this._applyInitialTheme();
        this._applySidebarState();
        this._applySettingsToUI();
        this.render();
    },

    _loadState() {
        this.state.tasks = JSON.parse(localStorage.getItem(this.constants.STORAGE_KEY_TASKS) || "[]");
        this.state.projects = JSON.parse(localStorage.getItem(this.constants.STORAGE_KEY_PROJECTS) || "[]");
        this.state.extraColumns = JSON.parse(localStorage.getItem(this.constants.STORAGE_KEY_COLUMNS) || "[]");
        this.state.sidebarOpen = localStorage.getItem(this.constants.STORAGE_KEY_SIDEBAR) === '1';
        const savedSettings = JSON.parse(localStorage.getItem(this.constants.STORAGE_KEY_SETTINGS) || "null");
        if (savedSettings) this.state.settings = { ...this.state.settings, ...savedSettings };
    },

    _saveState() {
        localStorage.setItem(this.constants.STORAGE_KEY_TASKS, JSON.stringify(this.state.tasks));
        localStorage.setItem(this.constants.STORAGE_KEY_PROJECTS, JSON.stringify(this.state.projects));
        localStorage.setItem(this.constants.STORAGE_KEY_COLUMNS, JSON.stringify(this.state.extraColumns));
    },

    _saveSettings() {
        localStorage.setItem(this.constants.STORAGE_KEY_SETTINGS, JSON.stringify(this.state.settings));
    },

    _bindEvents() {
        this.dom.sidebarToggle.addEventListener('click', this.toggleSidebar.bind(this));
        this.dom.addProjectBtn.addEventListener('click', () => this.dom.projectModal.show());
        this.dom.sidebarDarkMode.addEventListener('click', this._handleThemeSwitch.bind(this));
        this.dom.sidebarSettings.addEventListener('click', () => this.openSettings());
        this.dom.sidebar.addEventListener('click', this._handleSidebarClick.bind(this));
        this.dom.confirmAddProject.addEventListener('click', this.addProject.bind(this));
        this.dom.homeAddProject.addEventListener('click', () => this.dom.projectModal.show());
        this.dom.projectsGrid.addEventListener('click', this._handleProjectCardClick.bind(this));
        this.dom.newProjectNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.addProject(); });
        this.dom.taskTableBody.addEventListener('click', this._handleTableClick.bind(this));
        this.dom.taskTableBody.addEventListener('click', this._handleCheckToggle.bind(this));
        this.dom.completedTableBody.addEventListener('click', this._handleTableClick.bind(this));
        this.dom.closeActivities.addEventListener('click', this.closeActivitiesPanel.bind(this));
        document.addEventListener("paste", this._handlePaste.bind(this));
        this.dom.addTaskButton.addEventListener('click', this.addTask.bind(this));
        this.dom.showCompletedButton.addEventListener('click', this.showCompleted.bind(this));
        this.dom.taskTableBody.addEventListener('focusout', this._handleCellBlur.bind(this));
        this.dom.activitiesTableBody.addEventListener('input', this._handleActivityDescInput.bind(this));
        this.dom.taskTableBody.addEventListener('keydown', this._handleCellKeydown.bind(this));
        document.querySelectorAll('.settings-nav-item').forEach(btn => {
            btn.addEventListener('click', this._handleSettingsNav.bind(this));
        });
        this.dom.themeSelect.addEventListener('change', this._handleThemeChange.bind(this));
        this.dom.enableSoundCheckbox.addEventListener('change', this._handleSoundToggle.bind(this));
        this.dom.volumeSlider.addEventListener('input', this._handleVolumeChange.bind(this));
        document.getElementById('settingsModal').addEventListener('hidden.bs.modal', this.saveSettings.bind(this));
        this.dom.skipActivityDescBtn.addEventListener('click', this.skipActivityDescription.bind(this));
        this.dom.saveActivityDescBtn.addEventListener('click', this.saveActivityDescription.bind(this));
        this.dom.activityDescription.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.saveActivityDescription();
        });
        // No _bindEvents
        this.dom.taskTableBody.addEventListener('focusin', (e) => {
            const content = e.target.closest('.task-desc-content');
            if (content) {
                content.dataset.focusTimer = setTimeout(() => {
                    content.classList.add('show-scrollbar');
                }, 1000);
            }
        });

        this.dom.taskTableBody.addEventListener('focusout', (e) => {
            const content = e.target.closest('.task-desc-content');
            if (content) {
                clearTimeout(content.dataset.focusTimer);
                content.classList.remove('show-scrollbar');
            }
        });
    },

    _applyInitialTheme() {
        const isDark = localStorage.getItem(this.constants.STORAGE_KEY_DARK_MODE) === '1';
        document.body.classList.toggle("dark", isDark);
        this._updateDarkModeIcon();
    },

    _applySidebarState() {
        if (this.state.sidebarOpen) this.dom.sidebar.classList.add('open');
    },

    _applySettingsToUI() {
        this.dom.themeSelect.value = document.body.classList.contains('dark') ? 'dark' : 'light';
        this.dom.timerBtn1Input.value = this.state.settings.timerButtons[0];
        this.dom.timerBtn2Input.value = this.state.settings.timerButtons[1];
        this.dom.timerBtn3Input.value = this.state.settings.timerButtons[2];
        this.dom.enableSoundCheckbox.checked = this.state.settings.enableSound;
        this.dom.volumeSlider.value = this.state.settings.volume;
        this.dom.volumeValue.textContent = `${this.state.settings.volume}%`;
        this._toggleVolumeControl();
    },

    _updateDarkModeIcon() {
        const isDark = document.body.classList.contains('dark');
        const icon = this.dom.sidebarDarkMode.querySelector('i');
        icon.className = isDark ? 'bi bi-sun' : 'bi bi-moon';
    },

    toggleSidebar() {
        this.state.sidebarOpen = !this.state.sidebarOpen;
        this.dom.sidebar.classList.toggle('open', this.state.sidebarOpen);
        localStorage.setItem(this.constants.STORAGE_KEY_SIDEBAR, this.state.sidebarOpen ? '1' : '0');
    },

    _handleSidebarClick(e) {
        const homeBtn = e.target.closest('.sidebar-item[data-project]');
        if (homeBtn && homeBtn.dataset.project === '') { this.selectProject(''); return; }
        const projectBtn = e.target.closest('.sidebar-project');
        if (projectBtn && !e.target.closest('.sidebar-project-delete')) {
            this.selectProject(projectBtn.dataset.project);
            return;
        }
        const deleteBtn = e.target.closest('.sidebar-project-delete');
        if (deleteBtn) this.deleteProject(deleteBtn.dataset.project);
    },

    _handleProjectCardClick(e) {
        const card = e.target.closest('.project-card');
        if (card && card.dataset.project) this.selectProject(card.dataset.project);
    },

    selectProject(projectName) {
        this.state.currentProject = projectName;
        this.closeActivitiesPanel(true);
        if (projectName === '') {
            this.dom.homeView.classList.remove('d-none');
            this.dom.projectView.classList.add('d-none');
        } else {
            this.dom.homeView.classList.add('d-none');
            this.dom.projectView.classList.remove('d-none');
            this.dom.currentProjectName.textContent = projectName;
        }
        this.render();
        this._renderProjectsList();
    },

    addProject() {
        const name = this.dom.newProjectNameInput.value.trim();
        if (!name) return;
        if (!this.state.projects.includes(name)) {
            this.state.projects.push(name);
            this._saveState();
        }
        this.dom.newProjectNameInput.value = '';
        this.dom.projectModal.hide();
        this.selectProject(name);
    },

    deleteProject(projectName) {
        if (!confirm(`Deletar projeto "${projectName}"?`)) return;
        this.state.projects = this.state.projects.filter(p => p !== projectName);
        this._saveState();
        if (this.state.currentProject === projectName) this.selectProject('');
        else this._renderProjectsList();
    },

    _renderProjectsList() {
        const taskProjects = [...new Set(this.state.tasks.map(t => t.task_label).filter(Boolean))];
        const allProjects = [...new Set([...this.state.projects, ...taskProjects])].sort();
        this.dom.projectsList.innerHTML = allProjects.map(p => `
            <label class="sidebar-project ${p === this.state.currentProject ? 'active' : ''}" data-project="${this.utils.escapeHtml(p)}">
                <button style="background:transparent;border:0;outline:0;overflow:hidden;color:inherit;" class="sidebar-project-name">
                    <i class="bi bi-folder"></i>
                    <span>${this.utils.escapeHtml(p)}</span>
                </button>
                <button class="sidebar-project-delete" data-project="${this.utils.escapeHtml(p)}">
                    <i class="bi bi-x"></i>
                </button>
            </label>
        `).join('');
        const homeBtn = this.dom.sidebar.querySelector('.sidebar-item[data-project=""]');
        if (homeBtn) homeBtn.classList.toggle('active', this.state.currentProject === '');
        this._renderProjectCards(allProjects);
    },

    _renderProjectCards(allProjects) {
        if (allProjects.length === 0) {
            this.dom.projectsGrid.innerHTML = `<div class="empty-projects"><i class="bi bi-folder-plus"></i><p>Nenhum projeto ainda.</p></div>`;
            return;
        }
        this.dom.projectsGrid.innerHTML = allProjects.map(p => {
            const projectTasks = this.state.tasks.filter(t => (t.task_label || '') === p);
            const pendingCount = projectTasks.filter(t => !t.checked).length;
            const totalTime = projectTasks.reduce((sum, t) => sum + this.utils.calcTotalTime(t.task_activity), 0);
            return `
                <div class="project-card" data-project="${this.utils.escapeHtml(p)}">
                    <div class="project-card-icon"><i class="bi bi-folder"></i></div>
                    <h5 class="project-card-name">${this.utils.escapeHtml(p)}</h5>
                    <div class="project-card-stats">
                        <span class="project-card-stat"><i class="bi bi-list-task"></i>${pendingCount} pendente${pendingCount !== 1 ? 's' : ''}</span>
                        <span class="project-card-stat"><i class="bi bi-clock"></i>${this.utils.formatTime(totalTime)}</span>
                    </div>
                </div>`;
        }).join('');
    },

    openSettings() {
        this._applySettingsToUI();
        document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
        document.querySelector('.settings-nav-item[data-section="general"]').classList.add('active');
        document.querySelector('.settings-section[data-section="general"]').classList.add('active');
        this.dom.settingsTitle.textContent = 'Geral';
        this.dom.settingsModal.show();
    },

    _handleSettingsNav(e) {
        const section = e.currentTarget.dataset.section;
        document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
        e.currentTarget.classList.add('active');
        document.querySelector(`.settings-section[data-section="${section}"]`).classList.add('active');
        const titles = { general: 'Geral', timer: 'Timer', sound: 'Som' };
        this.dom.settingsTitle.textContent = titles[section];
    },

    _handleThemeChange(e) {
        const isDark = e.target.value === 'dark';
        document.body.classList.toggle('dark', isDark);
        localStorage.setItem(this.constants.STORAGE_KEY_DARK_MODE, isDark ? '1' : '0');
        this._updateDarkModeIcon();
    },

    _handleSoundToggle(e) {
        this.state.settings.enableSound = e.target.checked;
        this._toggleVolumeControl();
    },

    _handleVolumeChange(e) {
        const volume = parseInt(e.target.value);
        this.state.settings.volume = volume;
        this.dom.volumeValue.textContent = `${volume}%`;
        this.dom.tickAudio.volume = volume / 100;
    },

    _toggleVolumeControl() {
        const isEnabled = this.dom.enableSoundCheckbox.checked;
        this.dom.volumeControl.style.opacity = isEnabled ? '1' : '0.4';
        this.dom.volumeControl.style.pointerEvents = isEnabled ? 'auto' : 'none';
    },

    saveSettings() {
        this.state.settings.timerButtons = [
            parseInt(this.dom.timerBtn1Input.value) || 15,
            parseInt(this.dom.timerBtn2Input.value) || 25,
            parseInt(this.dom.timerBtn3Input.value) || 45
        ];
        this.state.settings.enableSound = this.dom.enableSoundCheckbox.checked;
        this._saveSettings();
        this.render();
    },

    render() {
        if (this.state.currentProject === '') {
            this._renderProjectsList();
        } else {
            this._renderTable(this.dom.taskTableBody, this.dom.tableHead, false);
            this._renderProjectsList();
        }
    },

    _renderTable(tbody, thead, onlyDone) {
        tbody.innerHTML = "";
        thead.innerHTML = "";
        let filteredTasks = this.state.tasks.filter(t => onlyDone ? t.checked : !t.checked);
        if (this.state.currentProject) {
            filteredTasks = filteredTasks.filter(t => (t.task_label || "") === this.state.currentProject);
        }
        this._renderHead(thead);
        filteredTasks.forEach(task => {
            tbody.appendChild(this._createTaskRow(task));
        });
    },

    _renderHead(headElement) {
        const cols = [
            {key: "check", label: "✓", fit: "50px"},
            {key: "task_desc", label: "Tarefa"},
            {key: "total", label: "Total", fit: "120px"},
            {key: "timer", label: "Timer", fit: "180px"},
            {key: "actions", label: "", fit: "50px"}
        ];
        cols.forEach(col => {
            const th = document.createElement("th");
            if (col.fit) th.style.width = col.fit;
            th.textContent = col.label || '';
            headElement.appendChild(th);
        });
    },

    _createTaskRow(task) {
        const tr = document.createElement("tr");
        tr.dataset.taskId = task.task_id;
        if (task.task_id === this.state.activeTaskId) tr.classList.add("playing");
        const totalTime = this.utils.calcTotalTime(task.task_activity);
        const descHtml = this.utils.renderListOrText(task.task_desc || "");
        const isPlaying = this.state.activeTaskId === task.task_id;
        const [t1, t2, t3] = this.state.settings.timerButtons;
        const formatBtn = (m) => m === 0 ? '∞' : m;
        let timerHtml = isPlaying ? `
            <div class="timer-display">
                <span class="timer-value" data-id="${task.task_id}">00:00:00</span>
                <button class="timer-btn stop-btn" data-action="stop" data-id="${task.task_id}">
                    <i class="bi bi-stop-fill"></i> Parar
                </button>
            </div>` : `
            <div class="timer-buttons">
                <button class="timer-btn" data-action="start" data-id="${task.task_id}" data-minutes="${t1}">${formatBtn(t1)}</button>
                <button class="timer-btn" data-action="start" data-id="${task.task_id}" data-minutes="${t2}">${formatBtn(t2)}</button>
                <button class="timer-btn" data-action="start" data-id="${task.task_id}" data-minutes="${t3}">${formatBtn(t3)}</button>
                <button class="timer-btn" data-action="start" data-id="${task.task_id}" data-minutes="0">∞</button>
            </div>`;
        tr.innerHTML = `
            <td><input type="checkbox" ${task.checked ? "checked" : ""} data-action="toggle" data-id="${task.task_id}"></td>
            <td class="task-desc-cell" data-field="task_desc">
                <div class="task-desc-content" contenteditable="true" spellcheck="false">${descHtml}</div>
            </td>
            <td><span class="total" data-action="activities" data-id="${task.task_id}">${this.utils.formatTime(totalTime)}</span></td>
            <td>${timerHtml}</td>
            <td><button class="btn btn-sm" data-action="delete" data-id="${task.task_id}"><i class="bi bi-trash"></i></button></td>`;
        return tr;
    },

    showActivitiesPanel(taskId) {
        const task = this.state.tasks.find(t => t.task_id === taskId);
        if (!task) return;
        this.state.activeActivityTaskId = taskId;
        this.dom.activitiesTitle.textContent = task.task_desc || 'Atividades';
        this._renderActivities(taskId);
        const container = this.dom.tasksPanel.closest('.project-container');
        container.classList.remove('closing');
        this.dom.activitiesPanel.classList.remove('d-none');
        // Força reflow para garantir que d-none foi removido antes de adicionar split
        void this.dom.activitiesPanel.offsetHeight;
        container.classList.add('split');
    },

    closeActivitiesPanel(immediate = false) {
        this.state.activeActivityTaskId = null;
        const container = this.dom.tasksPanel.closest('.project-container');
        if (!container) {
            this.dom.activitiesPanel.classList.add('d-none');
            return;
        }

        if (immediate) {
            container.classList.remove('split', 'closing');
            setTimeout(() => this.dom.activitiesPanel.classList.add('d-none'), 500);
        } else {
            // Fase 1: fade out (adiciona closing, remove split)
            container.classList.add('closing');
            container.classList.remove('split');

            // Fase 2: após animação completa, limpa tudo
            setTimeout(() => {
                if (!this.state.activeActivityTaskId) {
                    container.classList.remove('closing');
                    this.dom.activitiesPanel.classList.add('d-none');
                }
            }, 500); // 0.2s fade + 0.3s grid
        }
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
                <td contenteditable="true" data-task-id="${taskId}" data-activity-idx="${idx}">${this.utils.escapeHtml(act.desc || "")}</td>`;
            this.dom.activitiesTableBody.appendChild(tr);
        });
    },

    addTask() {
        this.state.tasks.unshift({
            task_id: Date.now(),
            task_desc: "",
            task_label: this.state.currentProject,
            task_activity: [],
            checked: false,
            extra: {}
        });
        this._saveState();
        this.render();
        const firstRow = this.dom.taskTableBody.querySelector('tr');
        if (firstRow) {
            const descCell = firstRow.querySelector('.task-desc-content');
            if (descCell) descCell.focus();
        }
    },

    deleteTask(taskId) {
        if (this.state.activeTaskId === taskId) this.stopTimer(false);
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
            if (!task.checked && this.dom.completedCanvas._isShown) {
                this._renderTable(this.dom.completedTableBody, this.dom.completedHead, true);
            }
        }
    },

    showCompleted() {
        this._renderTable(this.dom.completedTableBody, this.dom.completedHead, true);
        this.dom.completedCanvas.show();
    },

    startTimer(taskId, minutes) {
        if (this.state.activeTaskId) this.stopTimer(false);
        this.state.activeTaskId = taskId;
        this.state.activeTimerMode = minutes;
        const task = this.state.tasks.find(t => t.task_id === taskId);
        task.task_activity.push({ start: Date.now(), end: null, total: 0, desc: '' });
        this._saveState();
        this.pip.show();
        if (this.state.settings.enableSound) {
            this.dom.tickAudio.volume = this.state.settings.volume / 100;
            this.dom.tickAudio.loop = true;
            this.dom.tickAudio.play().catch(() => {});
        }
        this.render();
        const isStopwatch = minutes === 0;
        let elapsed = 0;
        const duration = minutes * 60;
        this.state.intervalId = setInterval(() => {
            elapsed++;
            let displayTime = isStopwatch ? elapsed : Math.max(0, duration - elapsed);
            const timerSpan = document.querySelector(`.timer-value[data-id="${taskId}"]`);
            const timeStr = this.utils.formatTime(displayTime);
            if (timerSpan) timerSpan.textContent = timeStr;
            this.pip.updateDisplay(timeStr);
            if (!isStopwatch && displayTime <= 0) this.stopTimer(true);
        }, 1000);
    },

    stopTimer(showModal = true) {
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
        this._saveState();
        if (showModal && currentActivity) {
            this.state.pendingActivityDesc = {
                taskId: this.state.activeTaskId,
                activityIndex: task.task_activity.length - 1,
                timeSpent: currentActivity.total,
                taskName: task.task_desc
            };
            this.dom.activityTimeSpent.textContent = this.utils.formatTime(currentActivity.total);
            this.dom.activityTaskName.textContent = task.task_desc || 'Tarefa sem nome';
            this.dom.activityDescription.value = '';
            this.state.activeTaskId = null;
            this.state.activeTimerMode = null;
            this.render();
            this.dom.activityDescModal.show();
            setTimeout(() => this.dom.activityDescription.focus(), 300);
        } else {
            this.state.activeTaskId = null;
            this.state.activeTimerMode = null;
            this.render();
        }
    },

    skipActivityDescription() {
        this.state.pendingActivityDesc = null;
        this.dom.activityDescModal.hide();
    },

    saveActivityDescription() {
        if (!this.state.pendingActivityDesc) return;
        const { taskId, activityIndex } = this.state.pendingActivityDesc;
        const task = this.state.tasks.find(t => t.task_id === taskId);
        if (task && task.task_activity[activityIndex]) {
            task.task_activity[activityIndex].desc = this.dom.activityDescription.value.trim();
            this._saveState();
        }
        this.state.pendingActivityDesc = null;
        this.dom.activityDescModal.hide();
    },

    _handleTableClick(e) {
        const target = e.target.closest("[data-action]");
        if (!target) return;
        const action = target.dataset.action;
        const id = Number(target.dataset.id);
        switch (action) {
            case 'start': this.startTimer(id, parseInt(target.dataset.minutes)); break;
            case 'stop': this.stopTimer(true); break;
            case 'delete': this.deleteTask(id); break;
            case 'toggle': this.toggleTaskStatus(id); break;
            case 'activities': this.showActivitiesPanel(id); break;
        }
    },

    _handleCheckToggle(e) {
        const cell = e.target.closest('.task-desc-content');
        if (!cell) return;
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        if (node.nodeType !== Node.TEXT_NODE) return;
        if (this._toggleCheckInNode(node, range.startOffset)) {
            this._updateLineStyle(node);
            const tr = cell.closest('tr');
            if (tr?.dataset.taskId) {
                const task = this.state.tasks.find(t => t.task_id === Number(tr.dataset.taskId));
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
        node.replaceData(charPos, 1, STATES[(currentIndex + 1) % STATES.length]);
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
        if (/^\[✓\]/.test(text)) lineElement.classList.add('line-done');
        else if (/^\[✕\]/.test(text)) lineElement.classList.add('line-blocked');
        else if (/^\[—\]/.test(text)) lineElement.classList.add('line-waiting');
    },

    _handleCellKeydown(e) {
        if (e.key !== 'Enter') return;
        const cell = e.target.closest('.task-desc-content');
        if (!cell) { e.preventDefault(); return; }
        e.preventDefault();
        document.execCommand("insertText", false, "\n[ ] ");
    },

    _handleCellBlur(e) {
        const cell = e.target.closest('.task-desc-content');
        if (!cell) return;
        const tr = cell.closest('tr');
        if (!tr || !tr.dataset.taskId) return;
        const task = this.state.tasks.find(t => t.task_id === Number(tr.dataset.taskId));
        if (!task) return;
        task.task_desc = this.utils.extractPlainText(cell);
        this._saveState();
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
        this.dom.themeSelect.value = isDark ? 'dark' : 'light';
    },

    _handlePaste(e) {
        const target = e.target;
        if (!target.isContentEditable) return;
        e.preventDefault();
        let text = (e.clipboardData || window.clipboardData).getData("text/plain");
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const result = lines.length > 1 ? lines.map(l => `[ ] ${l}`).join('\n') : lines[0] || '';
        document.execCommand("insertText", false, result);
    },

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
            clone.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
            clone.querySelectorAll('div, p, li, span').forEach(el => {
                const text = el.textContent;
                if (text) el.replaceWith(text + '\n');
            });
            return clone.textContent.replace(/\n{3,}/g, '\n\n').trim();
        },
        renderListOrText(text) {
            if (!text || !text.trim()) return '';
            return text.split(/\r?\n/).map(line => {
                const escaped = this.escapeHtml(line);
                if (/^\[✓\]/.test(line)) return `<div class="line-done">${escaped}</div>`;
                if (/^\[✕\]/.test(line)) return `<div class="line-blocked">${escaped}</div>`;
                if (/^\[—\]/.test(line)) return `<div class="line-waiting">${escaped}</div>`;
                return `<div>${escaped}</div>`;
            }).join('');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => TaskTrackerApp.init());