let tasks = [];
let currentFilter = 'all';
let deleteTargetId = null;
let mouseX = 0, mouseY = 0;

document.addEventListener('DOMContentLoaded', () => {
    loadTasks();
    renderTasks();
    updateStats();
    initAuroraCanvas();
    initMouseTracker();
    initMagneticElements();
    initScrollAnimations();
    initParallaxGeo();
    initKeyboardShortcuts();
    initTypingEffect();
    checkReminders();
    setInterval(checkReminders, 60000);
});

function loadTasks() {
    try {
        const d = localStorage.getItem('taskmanager_tasks');
        tasks = d ? JSON.parse(d) : [];
    } catch { tasks = []; }
}

function saveTasks() {
    localStorage.setItem('taskmanager_tasks', JSON.stringify(tasks));
}

function generateId() {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function addTask(title, description, dueDate, priority, category) {
    tasks.unshift({
        id: generateId(), title, description, dueDate, priority, category,
        completed: false, createdAt: new Date().toISOString()
    });
    saveTasks(); renderTasks(); updateStats();
    showToast('Task created!', 'success');
}

function updateTask(id, title, description, dueDate, priority, category) {
    const t = tasks.find(t => t.id === id);
    if (t) {
        Object.assign(t, { title, description, dueDate, priority, category });
        saveTasks(); renderTasks(); updateStats();
        showToast('Task updated!', 'info');
    }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks(); renderTasks(); updateStats();
    showToast('Task deleted!', 'error');
}

function toggleComplete(id) {
    const t = tasks.find(t => t.id === id);
    if (t) {
        t.completed = !t.completed;
        saveTasks(); renderTasks(); updateStats();
        showToast(t.completed ? 'Task completed! ✨' : 'Task reopened', t.completed ? 'success' : 'warning');
    }
}

function setFilter(f) {
    currentFilter = f;
    document.querySelectorAll('.pill').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
    renderTasks();
}

function searchTasks() { renderTasks(); }

function getFilteredTasks() {
    const q = document.getElementById('searchInput').value.toLowerCase().trim();
    let arr = [...tasks];
    const now = new Date(); now.setHours(0,0,0,0);

    if (currentFilter === 'pending') arr = arr.filter(t => !t.completed);
    else if (currentFilter === 'completed') arr = arr.filter(t => t.completed);
    else if (currentFilter === 'overdue') arr = arr.filter(t => {
        const d = new Date(t.dueDate); d.setHours(0,0,0,0);
        return !t.completed && d < now;
    });

    if (q) arr = arr.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q));

    return arr;
}

function renderTasks() {
    const grid = document.getElementById('taskGrid');
    const empty = document.getElementById('emptyState');
    const filtered = getFilteredTasks();

    if (!filtered.length) {
        grid.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    grid.innerHTML = filtered.map(t => renderCard(t)).join('');
    init3DTilt();
}

function renderCard(task) {
    const now = new Date(); now.setHours(0,0,0,0);
    const due = new Date(task.dueDate); due.setHours(0,0,0,0);
    const overdue = !task.completed && due < now;
    const daysLeft = Math.ceil((due - now) / 864e5);

    const catEmoji = { work:'💼', personal:'🏠', health:'💪', learning:'📚', finance:'💰', other:'🎯' };
    const priLabel = { low:'Low', medium:'Med', high:'High', critical:'Crit' };

    let timeTag = '';
    if (!task.completed) {
        if (overdue) timeTag = `<span class="tag tag-time urgent">OVERDUE ${Math.abs(daysLeft)}D</span>`;
        else if (daysLeft === 0) timeTag = `<span class="tag tag-time urgent">TODAY</span>`;
        else if (daysLeft <= 3) timeTag = `<span class="tag tag-time soon">${daysLeft}D LEFT</span>`;
        else timeTag = `<span class="tag tag-time safe">${daysLeft}D LEFT</span>`;
    }

    let prog = 0;
    if (task.completed) prog = 100;
    else {
        const cr = new Date(task.createdAt);
        const total = due - cr, elapsed = now - cr;
        prog = total > 0 ? Math.min(100, Math.max(0, (elapsed / total) * 100)) : 100;
    }

    const pColor = task.completed ? 'linear-gradient(90deg,#10b981,#059669)'
        : prog > 80 ? 'linear-gradient(90deg,#f43f5e,#e53e3e)'
        : prog > 50 ? 'linear-gradient(90deg,#fbbf24,#f59e0b)'
        : 'linear-gradient(90deg,#7c3aed,#06b6d4)';

    const dateStr = due.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });

    return `
    <div class="task-card ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}" data-id="${task.id}">
        <div class="priority-stripe ${task.priority}"></div>
        <div class="task-card-header">
            <h3 class="task-title">${esc(task.title)}</h3>
            <label class="task-checkbox">
                <input type="checkbox" ${task.completed ? 'checked' : ''} onchange="toggleComplete('${task.id}')">
                <span class="checkmark"><i class="fas fa-check"></i></span>
            </label>
        </div>
        ${task.description ? `<p class="task-desc">${esc(task.description)}</p>` : ''}
        <div class="task-meta">
            <span class="tag tag-date ${overdue ? 'overdue' : ''}"><i class="fas fa-calendar-alt"></i> ${dateStr}</span>
            <span class="tag tag-cat">${catEmoji[task.category]||'🎯'} ${cap(task.category)}</span>
            <span class="tag tag-pri ${task.priority}">${priLabel[task.priority]}</span>
            ${timeTag}
        </div>
        <div class="progress-track">
            <div class="progress-fill" style="width:${prog}%;background:${pColor}"></div>
        </div>
        <div class="task-actions">
            <button class="act-btn edit" onclick="editTask('${task.id}')" title="Edit"><i class="fas fa-pen"></i></button>
            <button class="act-btn delete" onclick="openDeleteModal('${task.id}')" title="Delete"><i class="fas fa-trash-alt"></i></button>
        </div>
    </div>`;
}

function updateStats() {
    const now = new Date(); now.setHours(0,0,0,0);
    animateNum('totalTasksStat', tasks.length);
    animateNum('completedStat', tasks.filter(t => t.completed).length);
    animateNum('pendingStat', tasks.filter(t => !t.completed).length);
    animateNum('overdueStat', tasks.filter(t => {
        const d = new Date(t.dueDate); d.setHours(0,0,0,0);
        return !t.completed && d < now;
    }).length);
}

function animateNum(id, target) {
    const el = document.getElementById(id);
    const from = parseInt(el.textContent) || 0;
    if (from === target) return;
    const start = performance.now();
    (function tick(t) {
        const p = Math.min((t - start) / 600, 1);
        const e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(from + (target - from) * e);
        if (p < 1) requestAnimationFrame(tick);
    })(start);
}

function openModal(editId = null) {
    const modal = document.getElementById('taskModal');
    const form = document.getElementById('taskForm');
    const title = document.getElementById('modalTitle');
    const btn = document.getElementById('submitBtn');
    const eid = document.getElementById('editTaskId');
    form.reset(); eid.value = '';

    if (editId) {
        const t = tasks.find(t => t.id === editId);
        if (t) {
            title.innerHTML = '<i class="fas fa-edit"></i> Edit Task';
            btn.innerHTML = '<span>Save</span><div class="btn-shimmer"></div>';
            eid.value = t.id;
            document.getElementById('taskTitle').value = t.title;
            document.getElementById('taskDesc').value = t.description;
            document.getElementById('taskDate').value = t.dueDate;
            document.getElementById('taskPriority').value = t.priority;
            document.getElementById('taskCategory').value = t.category;
        }
    } else {
        title.innerHTML = '<i class="fas fa-plus-circle"></i> Add New Task';
        btn.innerHTML = '<span>Add Task</span><div class="btn-shimmer"></div>';
        const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
        document.getElementById('taskDate').value = tmrw.toISOString().split('T')[0];
    }

    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('taskTitle').focus(), 100);
}

function closeModal() { document.getElementById('taskModal').classList.add('hidden'); }
function editTask(id) { openModal(id); }

function handleSubmit(e) {
    e.preventDefault();
    const eid = document.getElementById('editTaskId').value;
    const t = document.getElementById('taskTitle').value.trim();
    const d = document.getElementById('taskDesc').value.trim();
    const dt = document.getElementById('taskDate').value;
    const p = document.getElementById('taskPriority').value;
    const c = document.getElementById('taskCategory').value;
    if (!t) return;
    eid ? updateTask(eid, t, d, dt, p, c) : addTask(t, d, dt, p, c);
    closeModal();
}

function openDeleteModal(id) {
    deleteTargetId = id;
    document.getElementById('deleteModal').classList.remove('hidden');
}
function closeDeleteModal() {
    deleteTargetId = null;
    document.getElementById('deleteModal').classList.add('hidden');
}
function confirmDelete() {
    if (deleteTargetId) { deleteTask(deleteTargetId); closeDeleteModal(); }
}

function checkReminders() {
    const now = new Date(); now.setHours(0,0,0,0);
    const upcoming = tasks.filter(t => {
        if (t.completed) return false;
        const d = new Date(t.dueDate); d.setHours(0,0,0,0);
        const days = Math.ceil((d - now) / 864e5);
        return days >= 0 && days <= 2;
    });

    if (upcoming.length) {
        const last = localStorage.getItem('taskmanager_last_reminder');
        const today = now.toISOString().split('T')[0];
        if (last !== today) {
            showReminder(upcoming);
            localStorage.setItem('taskmanager_last_reminder', today);
        }
    }
}

function showReminder(list) {
    const now = new Date(); now.setHours(0,0,0,0);
    document.getElementById('reminderList').innerHTML = list.map(t => {
        const d = new Date(t.dueDate); d.setHours(0,0,0,0);
        const days = Math.ceil((d - now) / 864e5);
        const label = days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days} days`;
        return `<div class="reminder-item"><span class="reminder-item-title">${esc(t.title)}</span><span class="reminder-item-date">${label}</span></div>`;
    }).join('');
    document.getElementById('reminderModal').classList.remove('hidden');
}
function closeReminder() { document.getElementById('reminderModal').classList.add('hidden'); }

function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    const icons = { success:'fa-check-circle', error:'fa-skull', warning:'fa-exclamation-circle', info:'fa-info-circle' };
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon"><i class="fas ${icons[type]}"></i></span><span>${msg}</span>`;
    c.appendChild(t);
    setTimeout(() => { t.classList.add('exit'); setTimeout(() => t.remove(), 300); }, 3000);
}

function initAuroraCanvas() {
    const canvas = document.getElementById('auroraCanvas');
    const ctx = canvas.getContext('2d');
    let w, h, time = 0;

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    const particles = [];
    const PCOUNT = Math.min(60, Math.floor(window.innerWidth / 25));

    class AuroraParticle {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = Math.random() * w;
            this.y = Math.random() * h;
            this.vx = (Math.random() - 0.5) * 0.3;
            this.vy = (Math.random() - 0.5) * 0.3;
            this.life = Math.random() * 300 + 200;
            this.maxLife = this.life;
            this.size = Math.random() * 2 + 0.5;
            this.hue = Math.random() * 60 + 250;
            this.trail = [];
        }
        update() {

            const angle = (Math.sin(this.x * 0.003 + time * 0.001) + Math.cos(this.y * 0.003 + time * 0.0012)) * Math.PI;
            this.vx += Math.cos(angle) * 0.015;
            this.vy += Math.sin(angle) * 0.015;

            const dx = mouseX - this.x, dy = mouseY - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 250) {
                const force = (250 - dist) / 250 * 0.08;
                this.vx -= dx / dist * force;
                this.vy -= dy / dist * force;
            }

            this.vx *= 0.98;
            this.vy *= 0.98;

            this.x += this.vx;
            this.y += this.vy;

            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > 20) this.trail.shift();

            this.life--;
            if (this.life <= 0 || this.x < -50 || this.x > w + 50 || this.y < -50 || this.y > h + 50)
                this.reset();
        }
        draw() {
            const alpha = Math.min(this.life / 50, (this.maxLife - this.life) / 50, 1) * 0.6;

            if (this.trail.length > 2) {
                ctx.beginPath();
                ctx.moveTo(this.trail[0].x, this.trail[0].y);
                for (let i = 1; i < this.trail.length; i++) {
                    ctx.lineTo(this.trail[i].x, this.trail[i].y);
                }
                ctx.strokeStyle = `hsla(${this.hue}, 80%, 65%, ${alpha * 0.2})`;
                ctx.lineWidth = this.size * 0.8;
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 80%, 70%, ${alpha})`;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
            ctx.fillStyle = `hsla(${this.hue}, 80%, 60%, ${alpha * 0.08})`;
            ctx.fill();
        }
    }

    for (let i = 0; i < PCOUNT; i++) particles.push(new AuroraParticle());

    function drawAurora() {
        for (let wave = 0; wave < 3; wave++) {
            ctx.beginPath();
            const hue = 260 + wave * 30 + Math.sin(time * 0.001) * 20;
            const yBase = h * 0.3 + wave * 80 + Math.sin(time * 0.0008 + wave) * 50;

            ctx.moveTo(0, yBase);
            for (let x = 0; x <= w; x += 5) {
                const y = yBase +
                    Math.sin(x * 0.003 + time * 0.001 + wave * 2) * 40 +
                    Math.sin(x * 0.007 + time * 0.0015) * 20 +
                    Math.cos(x * 0.001 + time * 0.0008 + wave) * 30;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();

            const grad = ctx.createLinearGradient(0, yBase - 80, 0, yBase + 200);
            grad.addColorStop(0, `hsla(${hue}, 70%, 50%, 0)`);
            grad.addColorStop(0.3, `hsla(${hue}, 70%, 50%, 0.02)`);
            grad.addColorStop(0.6, `hsla(${hue}, 60%, 45%, 0.015)`);
            grad.addColorStop(1, `hsla(${hue}, 60%, 40%, 0)`);
            ctx.fillStyle = grad;
            ctx.fill();
        }
    }

    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 120) {
                    const a = (1 - d / 120) * 0.08;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(167, 139, 250, ${a})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }

    function animate() {
        ctx.clearRect(0, 0, w, h);
        time++;

        drawAurora();
        particles.forEach(p => { p.update(); p.draw(); });
        drawConnections();

        requestAnimationFrame(animate);
    }

    animate();
}

function initMouseTracker() {
    document.addEventListener('mousemove', e => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });
}

function initMagneticElements() {
    document.querySelectorAll('.magnetic').forEach(el => {
        el.addEventListener('mousemove', e => {
            const rect = el.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            el.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
        });
        el.addEventListener('mouseleave', () => {
            el.style.transform = 'translate(0, 0)';
        });
    });
}

function init3DTilt() {
    document.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('mousemove', e => {
            const r = card.getBoundingClientRect();
            const x = e.clientX - r.left;
            const y = e.clientY - r.top;
            const cx = r.width / 2;
            const cy = r.height / 2;
            const rotX = ((y - cy) / cy) * -10;
            const rotY = ((x - cx) / cx) * 10;

            card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.03, 1.03, 1.03)`;
            card.style.setProperty('--mouse-x', x + 'px');
            card.style.setProperty('--mouse-y', y + 'px');

            const angle = Math.atan2(y - cy, x - cx) * (180 / Math.PI);
            card.style.setProperty('--card-angle', angle + 'deg');
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) scale3d(1,1,1)';
        });
    });
}

function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) entry.target.classList.add('visible');
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.scroll-anim').forEach(el => observer.observe(el));
}

function initParallaxGeo() {
    const geos = document.querySelectorAll('.geo');
    const speeds = [0.02, 0.03, 0.015, 0.025, 0.035, 0.02];

    window.addEventListener('mousemove', e => {
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;

        geos.forEach((g, i) => {
            const s = speeds[i % speeds.length];
            g.style.transform = `translate(${dx * s}px, ${dy * s}px)`;
        });
    });
}

document.addEventListener('mousemove', e => {
    document.querySelectorAll('.holo-card').forEach(card => {
        const r = card.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        const angle = Math.atan2(y, x) * (180 / Math.PI);
        card.style.setProperty('--holo-angle', angle + 'deg');
    });
});

function initTypingEffect() {
    const el = document.querySelector('.typed-text');
    if (!el) return;
    const phrases = ['Add. Track. Conquer.', 'Organize your chaos.', 'Ship everything on time.', 'Zero missed deadlines.'];
    let phraseIdx = 0, charIdx = 0, deleting = false;

    function type() {
        const current = phrases[phraseIdx];
        if (deleting) {
            el.textContent = current.substring(0, charIdx--);
            if (charIdx < 0) {
                deleting = false;
                phraseIdx = (phraseIdx + 1) % phrases.length;
                setTimeout(type, 400);
                return;
            }
            setTimeout(type, 30);
        } else {
            el.textContent = current.substring(0, charIdx++);
            if (charIdx > current.length) {
                deleting = true;
                setTimeout(type, 2000);
                return;
            }
            setTimeout(type, 60);
        }
    }
    setTimeout(type, 1000);
}

function initKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
        if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('searchInput').focus(); }
        if (e.key === 'Escape') { closeModal(); closeDeleteModal(); closeReminder(); }
        if (e.ctrlKey && e.key === 'n') { e.preventDefault(); openModal(); }
    });
}

document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
        e.preventDefault();
        const t = document.querySelector(a.getAttribute('href'));
        if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});

function esc(s) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
