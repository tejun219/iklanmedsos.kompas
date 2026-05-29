/* Frontend Application Controller for Kompas Social Media Ad Outline Board */

// Initialize working state by deep cloning INITIAL_DATA
let WORKING_DATA = {};
try {
  WORKING_DATA = JSON.parse(JSON.stringify(INITIAL_DATA));
} catch (e) {
  console.error("Failed to parse initial data", e);
  WORKING_DATA = {};
}

// Global Application State Variables
let currentMonth = "";
let selectedDayNum = null;
let currentTheme = localStorage.getItem("theme") || "light";
let activeFilters = {
  search: "",
  platform: "",
  ae: ""
};
let activeSort = {
  column: "",
  direction: "asc"
};

// Omset Range Mode: when active, the main table shows data across multiple months
let omsetRangeMode = false;       // true when range is being previewed
let omsetRangeSheets = [];        // list of matching sheet keys (sorted)

// Pagination state
const ROWS_PER_PAGE = 20;
let currentPage = 1;

// Admin Mode State Management
let isAdminLoggedIn = sessionStorage.getItem("isAdminLoggedIn") === "true";
let adminPassword = sessionStorage.getItem("adminPassword") || "";
const isServerEnv = window.location.protocol.startsWith('http') && !window.location.hostname.endsWith('github.io');
let activeAeName = "";
let AVAILABLE_MEMOS = [];

// Global Chart Instances
let platformChartInstance = null;
let aeChartInstance = null;
let omsetChartInstance = null;

// Platform Categorization Map
const PLATFORM_MAP = {
  "ig story": { label: "IG Story", badgeClass: "badge-ig-story", color: "#e5a93c" },
  "ig storylink": { label: "IG Story Link", badgeClass: "badge-ig-story", color: "#e5a93c" },
  "ig story link": { label: "IG Story Link", badgeClass: "badge-ig-story", color: "#e5a93c" },
  "ig post carousell": { label: "IG Post Carousel", badgeClass: "badge-ig-post", color: "#06b6d4" },
  "ig post harian": { label: "IG Post Harian", badgeClass: "badge-ig-post", color: "#06b6d4" },
  "ig post": { label: "IG Post", badgeClass: "badge-ig-post", color: "#06b6d4" },
  "ig reels": { label: "IG Reels", badgeClass: "badge-ig-reels", color: "#ec4899" },
  "x harian": { label: "X (Twitter)", badgeClass: "badge-x", color: "#0ea5e9" },
  "x": { label: "X (Twitter)", badgeClass: "badge-x", color: "#0ea5e9" },
  "youtube": { label: "Youtube", badgeClass: "badge-youtube", color: "#ef4444" },
};

// Rate Card Standard Pricing for each publication channel
const RATE_CARD = {
  "IG Story Link Harian Kompas": 0,
  "IG Post Carousell Harian Kompas": 0,
  "IG Post harian Kompas": 0,
  "IG Reels Harian Kompas": 0,
  "IG Storylink Kompas Muda": 0,
  "IG Post Carousell Kompas Muda": 0,
  "IG Post Kompas Muda": 0,
  "X Harian Kompas": 0,
  "Youtube Harian Kompas": 0,
  "Kompas.id Web Banner": 0,
  "Default": 0
};

// Helper function to identify platform category from position string
function getPlatformInfo(position) {
  if (!position) return { label: "Lainnya", badgeClass: "badge-other", color: "#3b82f6" };
  const posLower = position.toLowerCase();
  
  for (const [key, value] of Object.entries(PLATFORM_MAP)) {
    if (posLower.includes(key)) {
      return value;
    }
  }
  return { label: "Lainnya", badgeClass: "badge-other", color: "#3b82f6" };
}

// Helper: Extract Day of Month from Tanggal Terbit string or YYYY-MM-DD
function getDayFromDate(dateStr) {
  if (!dateStr) return null;
  
  // Format is likely YYYY-MM-DD (e.g., 2026-05-02)
  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return parseInt(parts[2], 10);
    }
  }
  
  // Custom format like "08 Mei" or "2 May"
  const numMatch = dateStr.match(/^(\d+)/);
  if (numMatch) {
    return parseInt(numMatch[1], 10);
  }
  
  return null;
}

// Helper: Extract Year & Month index from sheet name (e.g. "Mei 2026")
function getMonthYearFromSheetName(sheetName) {
  const monthsMap = {
    'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
    'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
  };
  
  const parts = sheetName.split(' ');
  if (parts.length === 2) {
    const mStr = parts[0].toLowerCase();
    const yStr = parseInt(parts[1], 10);
    if (mStr in monthsMap && !isNaN(yStr)) {
      return { month: monthsMap[mStr], year: yStr };
    }
  }
  return { month: 4, year: 2026 }; // Default to May 2026 fallback
}

// Setup Theme Toggle on page load
function setupTheme() {
  document.documentElement.setAttribute("data-theme", currentTheme);
  const themeIcon = document.getElementById("theme-icon");
  if (currentTheme === "light") {
    themeIcon.className = "fa-solid fa-moon";
  } else {
    themeIcon.className = "fa-solid fa-sun";
  }
}

// Toggle light/dark mode theme
function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem("theme", currentTheme);
  setupTheme();
  // Re-render charts with updated theme colors
  renderCharts();
}

// Helper: Clean server error message and prevent rendering raw HTML/404 pages
function getCleanErrorMessage(err, defaultMsg = "Terjadi kesalahan") {
  if (!err) return defaultMsg;
  let msg = typeof err === 'string' ? err : (err.message || defaultMsg);
  msg = msg.trim();
  if (msg.startsWith('<') || msg.includes('<html>') || msg.includes('<!DOCTYPE')) {
    return "Respon server tidak valid (Format HTML)";
  }
  return msg;
}

// Show interactive dynamic notifications (Toast)
function showToast(message, type = "success") {
  const container = document.getElementById("toast-box");
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  
  const icon = type === "success" 
    ? '<i class="fa-solid fa-circle-check" style="color:var(--success)"></i>'
    : '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger)"></i>';
    
  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);
  
  // Slide in toast
  setTimeout(() => toast.classList.add("active"), 10);
  
  // Auto remove after 3.5 seconds
  setTimeout(() => {
    toast.classList.remove("active");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Initialize Application UI Componentry
function initApp() {
  setupTheme();
  
  // Register basic event listeners
  document.getElementById("theme-toggle").addEventListener("click", toggleTheme);
  
  // Tab Event Listeners
  const tabDistribusi = document.getElementById("tab-distribusi");
  const tabOmset = document.getElementById("tab-omset");
  const containerDistribusi = document.getElementById("container-distribusi");
  const containerOmset = document.getElementById("container-omset");
  
  if (tabDistribusi && tabOmset) {
    tabDistribusi.addEventListener("click", () => {
      tabDistribusi.classList.add("active");
      tabDistribusi.style.borderBottom = "2px solid var(--primary-light)";
      tabDistribusi.style.color = "var(--primary-light)";
      tabDistribusi.style.fontWeight = "700";
      
      tabOmset.classList.remove("active");
      tabOmset.style.borderBottom = "2px solid transparent";
      tabOmset.style.color = "var(--text-secondary)";
      tabOmset.style.fontWeight = "600";
      
      containerDistribusi.style.display = "block";
      containerOmset.style.display = "none";
    });
    
    tabOmset.addEventListener("click", () => {
      tabOmset.classList.add("active");
      tabOmset.style.borderBottom = "2px solid var(--primary-light)";
      tabOmset.style.color = "var(--primary-light)";
      tabOmset.style.fontWeight = "700";
      
      tabDistribusi.classList.remove("active");
      tabDistribusi.style.borderBottom = "2px solid transparent";
      tabDistribusi.style.color = "var(--text-secondary)";
      tabDistribusi.style.fontWeight = "600";
      
      containerDistribusi.style.display = "none";
      containerOmset.style.display = "block";
      
      // Render the social media ads gallery
      renderMedsosGallery();
    });
  }
  
  // Visitor Log Event Listeners
  document.getElementById("open-visitor-btn").addEventListener("click", openVisitorLogModal);
  document.getElementById("close-visitor-modal-btn").addEventListener("click", () => {
    document.getElementById("visitor-log-modal").classList.remove("active");
  });
  
  // Visitor Guide Event Listeners
  document.getElementById("open-guide-btn").addEventListener("click", openGuideModal);
  document.getElementById("close-guide-modal-btn").addEventListener("click", closeGuideModal);
  document.getElementById("guide-prev-btn").addEventListener("click", prevGuideSlide);
  document.getElementById("guide-next-btn").addEventListener("click", nextGuideSlide);
  
  // Sync G-Drive Event
  document.getElementById("sync-gdrive-btn").addEventListener("click", syncGoogleDrive);
  
  // Data Table toolbar actions
  document.getElementById("table-search").addEventListener("input", (e) => {
    activeFilters.search = e.target.value;
    currentPage = 1;
    renderTable();
  });
  
  document.getElementById("filter-platform").addEventListener("change", (e) => {
    activeFilters.platform = e.target.value;
    if (e.target.value !== "") {
      // Reset AE filter so they are mutually exclusive
      activeFilters.ae = "";
      document.getElementById("filter-ae").value = "";
    }
    currentPage = 1;
    renderTable();
  });
  
  document.getElementById("filter-ae").addEventListener("change", (e) => {
    activeFilters.ae = e.target.value;
    if (e.target.value !== "") {
      // Reset Platform filter so they are mutually exclusive
      activeFilters.platform = "";
      document.getElementById("filter-platform").value = "";
    }
    currentPage = 1;
    renderTable();
  });
  
  document.getElementById("download-omset-btn").addEventListener("click", downloadOmsetAE);

  // Omset range period dropdowns → update main table preview live
  const omsetStartEl = document.getElementById("omset-start-period");
  const omsetEndEl   = document.getElementById("omset-end-period");
  if (omsetStartEl && omsetEndEl) {
    omsetStartEl.addEventListener("change", applyOmsetRangeToTable);
    omsetEndEl.addEventListener("change", applyOmsetRangeToTable);
  }
  
  // Sort Headers events
  document.getElementById("sort-judul").addEventListener("click", () => toggleSort("judul"));
  document.getElementById("sort-posisi").addEventListener("click", () => toggleSort("posisi"));
  document.getElementById("sort-tgl").addEventListener("click", () => toggleSort("tgl_terbit"));
  document.getElementById("sort-ae").addEventListener("click", () => toggleSort("ae"));
  document.getElementById("sort-so").addEventListener("click", () => toggleSort("so"));

  // Planner Modal Dialog Handlers
  const modal = document.getElementById("ad-planner-modal");
  const loginModal = document.getElementById("admin-login-modal");
  
  document.getElementById("open-planner-btn").addEventListener("click", () => {
    if (!isAdminLoggedIn) {
      loginModal.classList.add("active");
      setTimeout(() => document.getElementById("login-password").focus(), 150);
      showToast("Harap login sebagai Admin untuk mengubah data!", "error");
      return;
    }
    
    // Prefill publication date to selected date or fallback to current month first date
    const dateInput = document.getElementById("form-date");
    const monthYear = getMonthYearFromSheetName(currentMonth);
    const mm = String(monthYear.month + 1).padStart(2, '0');
    const dd = String(selectedDayNum || 1).padStart(2, '0');
    dateInput.value = `${monthYear.year}-${mm}-${dd}`;
    
    modal.classList.add("active");
  });
  
  const closeModal = () => modal.classList.remove("active");
  document.getElementById("close-modal-btn").addEventListener("click", closeModal);
  document.getElementById("close-modal-cancel").addEventListener("click", closeModal);
  
  // AE Performance Modal close handlers
  const perfModal = document.getElementById("ae-performance-modal");
  const closePerfModal = () => perfModal.classList.remove("active");
  document.getElementById("close-perf-modal-btn").addEventListener("click", closePerfModal);
  document.getElementById("close-perf-modal-cancel").addEventListener("click", closePerfModal);
  
  // Ad Preview Modal Dialog Handlers
  const previewModal = document.getElementById("ad-preview-modal");
  document.getElementById("close-preview-modal-btn").addEventListener("click", closePreviewModal);
  document.getElementById("preview-modal-prev-btn").addEventListener("click", prevPreviewModal);
  document.getElementById("preview-modal-next-btn").addEventListener("click", nextPreviewModal);
  
  // Close preview modal on clicking outside the container
  if (previewModal) {
    previewModal.addEventListener("click", (e) => {
      if (e.target === previewModal) {
        closePreviewModal();
      }
    });
  }
  
  // Admin Mode Status Controls & Close Handlers
  updateAdminUI();
  
  const closeLogin = () => {
    loginModal.classList.remove("active");
    document.getElementById("login-error-alert").style.display = "none";
    document.getElementById("login-password").value = "";
  };
  
  document.getElementById("close-login-btn").addEventListener("click", closeLogin);
  
  document.getElementById("admin-lock-btn").addEventListener("click", () => {
    if (isAdminLoggedIn) {
      // Logout Admin
      isAdminLoggedIn = false;
      adminPassword = "";
      sessionStorage.removeItem("isAdminLoggedIn");
      sessionStorage.removeItem("adminPassword");
      updateAdminUI();
      showToast("Logout berhasil. Anda kembali ke Mode Tamu.", "success");
    } else {
      // Open Login modal
      loginModal.classList.add("active");
      setTimeout(() => document.getElementById("login-password").focus(), 150);
    }
  });
  
  // Admin Login Submission
  document.getElementById("admin-login-form").addEventListener("submit", handleAdminLogin);
  
  // Ad Outline Form Submit
  document.getElementById("ad-planner-form").addEventListener("submit", handleAddAdForm);
  

  // Check if running on server (Dynamic Fetch Mode)
  if (isServerEnv) {
    // Fetch available local memo file prefixes
    fetch('/api/available-memos?t=' + Date.now())
      .then(res => {
        if (!res.ok) throw new Error("Gagal mengambil data memo dari server");
        return res.json();
      })
      .then(data => {
        AVAILABLE_MEMOS = data;
        if (typeof renderTable === 'function') renderTable();
      })
      .catch(err => {
        console.warn("Failed to fetch available memos, fallback to standard checked mode", err);
      });

    fetch('/api/data?t=' + Date.now())
      .then(res => {
        if (!res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('text/html')) {
            throw new Error(`HTTP Error ${res.status} (${res.statusText || 'Not Found'})`);
          }
          return res.text().then(text => { throw new Error(text || `HTTP Error ${res.status}`); });
        }
        return res.json();
      })
      .then(data => {
        WORKING_DATA = data;
        initUIDisplay();
      })
      .catch(err => {
        console.error("Failed to fetch API data", err);
        showToast(`Gagal memuat data dari server: ${getCleanErrorMessage(err)}. Menggunakan cache lokal.`, "error");
        initUIDisplay();
      });
  } else {
    initUIDisplay();
  }
}

// Separate UI Render Initialization
function initUIDisplay() {
  const availableMonths = Object.keys(WORKING_DATA);
  if (availableMonths.length === 0) {
    showToast("Data outline tidak ditemukan!", "error");
    return;
  }
  
  // Setup default starting month to the current real-world month if available
  const now = new Date();
  const monthsIdNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const currentMonthStr = `${monthsIdNames[now.getMonth()]} ${now.getFullYear()}`;
  
  if (availableMonths.includes(currentMonthStr)) {
    currentMonth = currentMonthStr;
  } else if (availableMonths.includes("Mei 2026")) {
    currentMonth = "Mei 2026";
  } else {
    currentMonth = availableMonths[availableMonths.length - 1];
  }
  
  // Set selected date to today's date on initial load/refresh
  selectedDayNum = now.getDate();
  
  renderMonthTabs();
  loadMonthData();
  
  // Auto-onboarding trigger for first-time visitors
  setTimeout(() => {
    if (localStorage.getItem("guide_seen") !== "true") {
      openGuideModal();
    }
  }, 800);
}

// Render available sheets dynamically in two dropdown selectors (Year and Month)
function renderMonthTabs() {
  const yearSelect = document.getElementById("year-select");
  const monthSelect = document.getElementById("month-select");
  if (!yearSelect || !monthSelect) return;
  
  // Extract all available years and months from the keys
  const sheets = Object.keys(WORKING_DATA);
  const years = new Set();
  const yearMonthMap = {};
  
  sheets.forEach(sheet => {
    const parts = sheet.split(" ");
    if (parts.length === 2) {
      const m = parts[0];
      const y = parts[1];
      years.add(y);
      if (!yearMonthMap[y]) yearMonthMap[y] = [];
      yearMonthMap[y].push(m);
    }
  });
  
  // Convert sets to sorted arrays
  const sortedYears = Array.from(years).sort((a, b) => b - a); // descending
  
  // Determine current active year and month from `currentMonth` (e.g. "Mei 2026")
  let activeMonth = "";
  let activeYear = "";
  if (currentMonth) {
    const parts = currentMonth.split(" ");
    if (parts.length === 2) {
      activeMonth = parts[0];
      activeYear = parts[1];
    }
  }
  
  // Populate Year Dropdown
  yearSelect.innerHTML = "";
  sortedYears.forEach(y => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    if (y === activeYear) opt.selected = true;
    yearSelect.appendChild(opt);
  });
  
  // Helper to populate Month Dropdown based on selected Year
  const populateMonths = (selectedYear) => {
    monthSelect.innerHTML = "";
    const availableMonths = yearMonthMap[selectedYear] || [];
    // Define correct chronological order
    const monthOrder = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    // Sort months correctly
    availableMonths.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));
    
    availableMonths.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m;
      opt.textContent = m;
      if (m === activeMonth) opt.selected = true;
      monthSelect.appendChild(opt);
    });
    
    // Fallback if the previously active month is not available in the newly selected year
    if (!availableMonths.includes(activeMonth) && availableMonths.length > 0) {
      monthSelect.value = availableMonths[0];
      activeMonth = availableMonths[0];
    }
  };
  
  // Initial populate
  populateMonths(activeYear || sortedYears[0]);
  
  // Populate Omset specific dropdowns
  const omsetStartPeriod = document.getElementById("omset-start-period");
  const omsetEndPeriod = document.getElementById("omset-end-period");
  
  if (omsetStartPeriod && omsetEndPeriod) {
    omsetStartPeriod.innerHTML = "";
    omsetEndPeriod.innerHTML = "";
    
    // Sort all sheets chronologically
    const sheets = Object.keys(WORKING_DATA);
    const monthOrder = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const getSheetValue = (sheetName) => {
      if (!sheetName) return 0;
      const parts = sheetName.trim().split(/\s+/);
      if (parts.length === 2) {
        const monthIndex = monthOrder.map(m => m.toLowerCase()).indexOf(parts[0].toLowerCase());
        const yearVal = parseInt(parts[1], 10);
        if (monthIndex !== -1 && !isNaN(yearVal)) {
          return yearVal * 12 + monthIndex;
        }
      }
      return 0;
    };
    
    const sortedSheets = sheets.slice().sort((a, b) => getSheetValue(a) - getSheetValue(b));
    
    const shortMonthsMap = {
      'januari': 'Jan', 'februari': 'Feb', 'maret': 'Mar', 'april': 'Apr', 'mei': 'Mei', 'juni': 'Jun',
      'juli': 'Jul', 'agustus': 'Agu', 'september': 'Sep', 'oktober': 'Okt', 'november': 'Nov', 'desember': 'Des'
    };
    
    const shortenSheet = (sheetName) => {
      const parts = sheetName.split(' ');
      if (parts.length === 2) {
        const mStr = parts[0].toLowerCase();
        const yStr = parts[1];
        if (mStr in shortMonthsMap) {
          return `${shortMonthsMap[mStr]} ${yStr}`;
        }
      }
      return sheetName;
    };
    
    sortedSheets.forEach(sheet => {
      const optStart = document.createElement("option");
      optStart.value = sheet;
      optStart.textContent = shortenSheet(sheet);
      if (sheet === currentMonth) optStart.selected = true;
      omsetStartPeriod.appendChild(optStart);
      
      const optEnd = document.createElement("option");
      optEnd.value = sheet;
      optEnd.textContent = shortenSheet(sheet);
      if (sheet === currentMonth) optEnd.selected = true;
      omsetEndPeriod.appendChild(optEnd);
    });
  }
  
  // Event Listeners for Year and Month changes
  yearSelect.onchange = (e) => {
    activeYear = e.target.value;
    populateMonths(activeYear);
    currentMonth = `${monthSelect.value} ${activeYear}`;
    selectedDayNum = null;
    // Reset range mode when month/year changes manually
    omsetRangeMode = false;
    omsetRangeSheets = [];
    loadMonthData();
    showToast(`Memuat data ${currentMonth}`, "success");
  };
  
  monthSelect.onchange = (e) => {
    activeMonth = e.target.value;
    currentMonth = `${activeMonth} ${activeYear}`;
    selectedDayNum = null;
    // Reset range mode when month/year changes manually
    omsetRangeMode = false;
    omsetRangeSheets = [];
    loadMonthData();
    showToast(`Memuat data ${currentMonth}`, "success");
  };
}

// Load, analyze, and render active month's data models
function loadMonthData() {
  const monthData = WORKING_DATA[currentMonth] || [];
  
  // Update UI components
  renderKPIs(monthData);
  renderCharts();
  renderCalendar();
  populateFilters();
  renderTable();
  
  // Clear or reset active clicked day drawer on sheet swap
  const drawerAdList = document.getElementById("drawer-ad-list");
  const drawerDateHeading = document.getElementById("drawer-date-heading");
  const drawerDateSubheading = document.getElementById("drawer-date-subheading");
  
  if (selectedDayNum !== null) {
    const adsByDay = {};
    monthData.forEach(item => {
      const day = getDayFromDate(item.tgl_terbit);
      if (day) {
        if (!adsByDay[day]) adsByDay[day] = [];
        adsByDay[day].push(item);
      }
    });
    renderDayDetailDrawer(selectedDayNum, adsByDay[selectedDayNum] || []);
  } else {
    drawerDateHeading.textContent = "Pilih Tanggal";
    drawerDateSubheading.textContent = "Silakan klik tanggal pada kalender untuk melihat detail iklan";
    drawerAdList.innerHTML = `
      <div class="empty-ad-state">
        <div class="empty-ad-icon"><i class="fa-solid fa-calendar-check"></i></div>
        <p>Pilih tanggal pada kalender untuk memantau jadwal penempatan secara rinci</p>
      </div>
    `;
  }
  
  // If the Medsos Ads Gallery tab is currently active, render it
  if (document.getElementById("tab-omset") && document.getElementById("tab-omset").classList.contains("active")) {
    renderMedsosGallery();
  }
}

// Recalculate KPIs based on current dataset values
function renderKPIs(data) {
  // Volume: sum of total_ad fields
  let totalAdVolume = 0;
  // Dynamic set of unique social channels and active AEs
  const channels = new Set();
  const aes = new Set();
  // Dictionary to count ads on different days
  const dayAdCounts = {};
  
  data.forEach(item => {
    const vol = parseInt(item.total_ad) || 1;
    totalAdVolume += vol;
    
    if (item.posisi) channels.add(item.posisi);
    if (item.ae) aes.add(item.ae);
    
    const day = getDayFromDate(item.tgl_terbit);
    if (day) {
      dayAdCounts[day] = (dayAdCounts[day] || 0) + vol;
    }
  });
  
  // Render KPI values
  document.getElementById("kpi-total-volume").textContent = totalAdVolume;
  document.getElementById("kpi-total-ads-count").textContent = `${data.length} Baris Outline Iklan`;
  
  document.getElementById("kpi-active-channels").textContent = channels.size;
  
  // Highlight most active platform channel
  const platformCounts = {};
  data.forEach(item => {
    const plat = getPlatformInfo(item.posisi).label;
    platformCounts[plat] = (platformCounts[plat] || 0) + 1;
  });
  
  let mostActivePlat = "-";
  let maxPlatVal = 0;
  for (const [p, c] of Object.entries(platformCounts)) {
    if (c > maxPlatVal) {
      maxPlatVal = c;
      mostActivePlat = p;
    }
  }
  document.getElementById("kpi-channel-highlight").textContent = `Platform Teraktif: ${mostActivePlat}`;
  
  document.getElementById("kpi-active-aes").textContent = aes.size;
  document.getElementById("kpi-ae-highlight").textContent = `${aes.size} Account Executive`;
  
  // Determine Peak Day
  let peakDay = "-";
  let maxDayCount = 0;
  for (const [day, count] of Object.entries(dayAdCounts)) {
    if (count > maxDayCount) {
      maxDayCount = count;
      peakDay = `${day} ${currentMonth.split(' ')[0]}`;
    }
  }
  
  if (peakDay !== "-") {
    document.getElementById("kpi-peak-day").textContent = peakDay;
    document.getElementById("kpi-peak-day-sub").textContent = `${maxDayCount} Iklan Publikasi`;
  } else {
    document.getElementById("kpi-peak-day").textContent = "-";
    document.getElementById("kpi-peak-day-sub").textContent = "Jadwal Belum Terisi";
  }
}

// Populate AE Filter select dropdown list from current sheet (or range) unique values
function populateFilters() {
  const aeSelect = document.getElementById("filter-ae");
  
  // Clear previous options except the first "Semua AE"
  aeSelect.innerHTML = '<option value="">Semua AE</option>';
  
  const aes = new Set();
  
  // If range mode is active, collect AEs from all range sheets
  const sheetsToScan = (omsetRangeMode && omsetRangeSheets.length > 0)
    ? omsetRangeSheets
    : [currentMonth];
  
  sheetsToScan.forEach(sheet => {
    const data = WORKING_DATA[sheet] || [];
    data.forEach(item => {
      if (item.ae) aes.add(item.ae.trim());
    });
  });
  
  // Sort alphabetically and append options
  Array.from(aes).sort().forEach(ae => {
    const opt = document.createElement("option");
    opt.value = ae;
    opt.textContent = ae;
    aeSelect.appendChild(opt);
  });
}

// ─── OMSET RANGE PREVIEW ────────────────────────────────────────────────────
// Shared helper to compute getSheetValue (year*12+monthIndex)
function _getSheetValue(sheetName) {
  const monthOrder = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  if (!sheetName) return 0;
  const parts = sheetName.trim().split(/\s+/);
  if (parts.length === 2) {
    const monthIndex = monthOrder.map(m => m.toLowerCase()).indexOf(parts[0].toLowerCase());
    const yearVal = parseInt(parts[1], 10);
    if (monthIndex !== -1 && !isNaN(yearVal)) return yearVal * 12 + monthIndex;
  }
  return 0;
}

// Called whenever the omset start/end period dropdowns change
function applyOmsetRangeToTable() {
  const startPeriod = document.getElementById("omset-start-period").value;
  const endPeriod   = document.getElementById("omset-end-period").value;
  if (!startPeriod || !endPeriod) return;
  
  const startVal = _getSheetValue(startPeriod);
  const endVal   = _getSheetValue(endPeriod);
  
  // If start > end, swap silently
  const lo = Math.min(startVal, endVal);
  const hi = Math.max(startVal, endVal);
  
  // Find all matching sheets within range
  const allSheets = Object.keys(WORKING_DATA);
  const matching = allSheets
    .filter(sheet => { const v = _getSheetValue(sheet); return v >= lo && v <= hi; })
    .sort((a, b) => _getSheetValue(a) - _getSheetValue(b));
  
  omsetRangeSheets = matching;
  omsetRangeMode   = matching.length > 0;
  
  // Rebuild AE filter to include all AEs from range
  populateFilters();
  
  // Re-render table using the range data
  renderTable();
  
  if (matching.length > 0) {
    const shortMonths = {'januari':'Jan','februari':'Feb','maret':'Mar','april':'Apr','mei':'Mei','juni':'Jun','juli':'Jul','agustus':'Agu','september':'Sep','oktober':'Okt','november':'Nov','desember':'Des'};
    const shorten = s => { const p = s.split(' '); return (shortMonths[p[0].toLowerCase()]||p[0])+' '+p[1]; };
    const label = startPeriod === endPeriod ? shorten(startPeriod) : `${shorten(startPeriod)} s/d ${shorten(endPeriod)}`;
    showToast(`Tabel menampilkan data: ${label} (${matching.length} bulan)`, "success");
  }
}
window.applyOmsetRangeToTable = applyOmsetRangeToTable;

// Reset range mode and return to single-month view
function resetOmsetRange() {
  omsetRangeMode   = false;
  omsetRangeSheets = [];
  populateFilters();
  renderTable();
  showToast(`Tabel kembali menampilkan data bulan ${currentMonth}`, "success");
}
window.resetOmsetRange = resetOmsetRange;
// ────────────────────────────────────────────────────────────────────────────

// Render dynamic visual charts in the Analytics hub
function renderCharts() {
  const monthData = WORKING_DATA[currentMonth] || [];
  
  // 1. Social Media Channels Share & Revenue
  const platCounts = {};
  const platRevenue = {};
  monthData.forEach(item => {
    const platLabel = getPlatformInfo(item.posisi).label;
    const adCount = parseInt(item.total_ad) || 1;
    platCounts[platLabel] = (platCounts[platLabel] || 0) + adCount;
    
    const rate = (item.pendapatan !== "" && !isNaN(item.pendapatan)) ? parseFloat(item.pendapatan) : (RATE_CARD[item.posisi] || RATE_CARD["Default"]);
    platRevenue[platLabel] = (platRevenue[platLabel] || 0) + (adCount * rate);
  });
  
  const themeColors = currentTheme === "dark" 
    ? { text: "#f8fafc", grid: "rgba(255,255,255,0.06)", border: "rgba(255,255,255,0.1)" }
    : { text: "#0f172a", grid: "rgba(0,0,0,0.04)", border: "rgba(0,0,0,0.08)" };
    
  const chartColors = ["#e5a93c", "#06b6d4", "#ec4899", "#0ea5e9", "#ef4444", "#3b82f6", "#a855f7"];
  
  // Destroy old instances
  if (platformChartInstance) platformChartInstance.destroy();
  if (aeChartInstance) aeChartInstance.destroy();
  if (omsetChartInstance) omsetChartInstance.destroy();
  
  // Instantiating Doughnut Chart for Distribution
  const platCtx = document.getElementById("platform-chart").getContext("2d");
  const platLabels = Object.keys(platCounts);
  const platValues = Object.values(platCounts);
  
  if (platLabels.length > 0) {
    platformChartInstance = new Chart(platCtx, {
      type: 'doughnut',
      data: {
        labels: platLabels,
        datasets: [{
          data: platValues,
          backgroundColor: chartColors.slice(0, platLabels.length),
          borderWidth: 2,
          borderColor: currentTheme === "dark" ? "#1e293b" : "#ffffff"
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: themeColors.text,
              font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 }
            }
          }
        }
      }
    });
  } else {
    // Blank state fallback visual drawing
    platCtx.clearRect(0,0,100,100);
  }

  // Instantiating Doughnut Chart for Revenue
  const omsetCtxElem = document.getElementById("omset-chart");
  if (omsetCtxElem) {
    const omsetCtx = omsetCtxElem.getContext("2d");
    const omsetLabels = Object.keys(platRevenue);
    const omsetValues = Object.values(platRevenue);
    
    if (omsetLabels.length > 0) {
      omsetChartInstance = new Chart(omsetCtx, {
        type: 'doughnut',
        data: {
          labels: omsetLabels,
          datasets: [{
            data: omsetValues,
            backgroundColor: chartColors.slice(0, omsetLabels.length),
            borderWidth: 2,
            borderColor: currentTheme === "dark" ? "#1e293b" : "#ffffff"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: {
                color: themeColors.text,
                font: { family: 'Plus Jakarta Sans', size: 11, weight: 600 }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  let label = context.label || '';
                  if (label) {
                    label += ': ';
                  }
                  if (context.parsed !== null) {
                    label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(context.parsed);
                  }
                  return label;
                }
              }
            }
          }
        }
      });
    } else {
      omsetCtx.clearRect(0,0,100,100);
    }
  }
  
  // 2. AE Workloads Chart (Bar Chart)
  const aeCounts = {};
  monthData.forEach(item => {
    if (item.ae) {
      aeCounts[item.ae] = (aeCounts[item.ae] || 0) + (parseInt(item.total_ad) || 1);
    }
  });
  
  const aeCtx = document.getElementById("ae-chart").getContext("2d");
  const sortedAeEntries = Object.entries(aeCounts).sort((a, b) => b[1] - a[1]);
  const aeLabels = sortedAeEntries.map(entry => entry[0]);
  const aeValues = sortedAeEntries.map(entry => entry[1]);
  
  if (aeLabels.length > 0) {
    aeChartInstance = new Chart(aeCtx, {
      type: 'bar',
      data: {
        labels: aeLabels,
        datasets: [{
          label: 'Total Iklan',
          data: aeValues,
          backgroundColor: 'rgba(59, 130, 246, 0.65)',
          borderColor: '#3b82f6',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (elements && elements.length > 0) {
            const elementIndex = elements[0].index;
            const aeName = aeChartInstance.data.labels[elementIndex];
            openAePerformanceModal(aeName);
          }
        },
        onHover: (event, chartElement) => {
          event.native.target.style.cursor = chartElement.length ? 'pointer' : 'default';
        },
        scales: {
          x: {
            grid: { color: themeColors.grid },
            ticks: { color: themeColors.text, font: { family: 'Plus Jakarta Sans', size: 10 } }
          },
          y: {
            grid: { display: false },
            ticks: { color: themeColors.text, font: { family: 'Plus Jakarta Sans', size: 10, weight: 600 } }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  } else {
    aeCtx.clearRect(0,0,100,100);
  }
}

// State for single-ad spotlight viewer
let medsosSpotlightIndex = 0;
let medsosSpotlightAds = [];

// Render dynamic single-ad spotlight viewer for social media ads
function renderMedsosGallery() {
  const monthData = WORKING_DATA[currentMonth] || [];
  const galleryGrid = document.getElementById("ads-gallery-grid");
  if (!galleryGrid) return;

  // Preserve current ad if any before re-filtering
  const currentActiveAd = medsosSpotlightAds[medsosSpotlightIndex];
  const activeRowIdx = currentActiveAd ? currentActiveAd.row_idx : null;

  galleryGrid.innerHTML = "";

  // All social media ads in this month
  const allSocialAds = monthData.filter(ad => ad.tgl_terbit && ad.posisi && ad.judul);

  // Filter by selected calendar day if a day is active
  if (selectedDayNum !== null) {
    const mInfo = getMonthYearFromSheetName(currentMonth);
    const mm = String(mInfo.month + 1).padStart(2, '0');
    const dd = String(selectedDayNum).padStart(2, '0');
    const targetDate = `${mInfo.year}-${mm}-${dd}`;
    medsosSpotlightAds = allSocialAds.filter(ad => ad.tgl_terbit === targetDate);
  } else {
    medsosSpotlightAds = allSocialAds;
  }

  // Determine empty message
  const emptyMsg = selectedDayNum !== null
    ? `Tidak ada bukti tayang iklan pada tanggal ${selectedDayNum} ${currentMonth}.`
    : `Tidak ada outline iklan media sosial yang terdaftar pada bulan ${currentMonth}.`;

  if (medsosSpotlightAds.length === 0) {
    galleryGrid.innerHTML = `
      <div class="no-ads-gallery">
        <i class="fa-solid fa-photo-film"></i>
        <h3>${selectedDayNum !== null ? 'Tidak Ada Iklan pada Tanggal Ini' : 'Belum Ada Bukti Tayang Iklan'}</h3>
        <p>${emptyMsg}</p>
      </div>
    `;
    return;
  }

  // Try to preserve index if the ad is still in the filtered list
  if (activeRowIdx !== null) {
    const foundIdx = medsosSpotlightAds.findIndex(a => String(a.row_idx) === String(activeRowIdx));
    medsosSpotlightIndex = foundIdx !== -1 ? foundIdx : 0;
  } else {
    medsosSpotlightIndex = 0;
  }

  // Build a date filter label for the nav row
  const filterLabel = selectedDayNum !== null
    ? `<span class="spotlight-date-filter"><i class="fa-solid fa-calendar-day"></i> ${selectedDayNum} ${currentMonth} &nbsp;<button class="spotlight-clear-filter" onclick="medsosSpotlightClearFilter()" title="Tampilkan semua iklan bulan ini"><i class="fa-solid fa-xmark"></i></button></span>`
    : `<span class="spotlight-month-label"><i class="fa-solid fa-calendar"></i> ${currentMonth}</span>`;

  galleryGrid.innerHTML = `
    <div class="spotlight-wrapper" id="spotlight-wrapper">
      <div class="spotlight-nav-row">
        <button class="spotlight-nav-btn" id="spotlight-prev" onclick="medsosNavigate(-1)" title="Iklan Sebelumnya">
          <i class="fa-solid fa-chevron-left"></i>
        </button>
        <div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
          ${filterLabel}
          <span class="spotlight-counter" id="spotlight-counter"></span>
        </div>
        <button class="spotlight-nav-btn" id="spotlight-next" onclick="medsosNavigate(1)" title="Iklan Berikutnya">
          <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
      <div id="spotlight-card-area"></div>
    </div>
  `;

  renderSpotlightCard();
}
window.renderMedsosGallery = renderMedsosGallery;

// Clear date filter and show all ads for the month
function medsosSpotlightClearFilter() {
  selectedDayNum = null;
  document.querySelectorAll(".calendar-day-cell").forEach(c => c.classList.remove("active-day"));
  const drawerDateHeading = document.getElementById("drawer-date-heading");
  const drawerDateSubheading = document.getElementById("drawer-date-subheading");
  const drawerAdList = document.getElementById("drawer-ad-list");
  if (drawerDateHeading) drawerDateHeading.textContent = "Pilih Tanggal";
  if (drawerDateSubheading) drawerDateSubheading.textContent = "Silakan klik tanggal pada kalender untuk melihat detail iklan";
  if (drawerAdList) drawerAdList.innerHTML = `<div class="empty-ad-state"><div class="empty-ad-icon"><i class="fa-solid fa-calendar-check"></i></div><p>Pilih tanggal pada kalender untuk memantau jadwal penempatan secara rinci</p></div>`;
  renderMedsosGallery();
}
window.medsosSpotlightClearFilter = medsosSpotlightClearFilter;

// Navigate spotlight by delta (-1 prev, +1 next)
function medsosNavigate(delta) {
  medsosSpotlightIndex = (medsosSpotlightIndex + delta + medsosSpotlightAds.length) % medsosSpotlightAds.length;
  renderSpotlightCard();
}
window.medsosNavigate = medsosNavigate;

// Open Bukti Tayang Iklan tab and focus on specific ad
// Open Bukti Tayang Preview Modal
function openPreviewModal(index) {
  if (!medsosSpotlightAds || medsosSpotlightAds.length === 0) return;
  
  // Wrap index to be within bounds
  medsosSpotlightIndex = (index + medsosSpotlightAds.length) % medsosSpotlightAds.length;
  
  renderPreviewModalCard();
  
  const previewModal = document.getElementById("ad-preview-modal");
  if (previewModal) {
    previewModal.classList.add("active");
  }
}
window.openPreviewModal = openPreviewModal;

// Close Bukti Tayang Preview Modal
function closePreviewModal() {
  const previewModal = document.getElementById("ad-preview-modal");
  if (previewModal) {
    previewModal.classList.remove("active");
    // Clear content to stop playing video/audio
    const mediaContainer = document.getElementById("preview-modal-media");
    if (mediaContainer) mediaContainer.innerHTML = "";
  }
}
window.closePreviewModal = closePreviewModal;

// Navigate inside Preview Modal
function prevPreviewModal() {
  openPreviewModal(medsosSpotlightIndex - 1);
}
window.prevPreviewModal = prevPreviewModal;

function nextPreviewModal() {
  openPreviewModal(medsosSpotlightIndex + 1);
}
window.nextPreviewModal = nextPreviewModal;

// Render dynamic preview modal card content
function renderPreviewModalCard() {
  const mediaContainer = document.getElementById("preview-modal-media");
  const titleElem = document.getElementById("preview-modal-title");
  const badgeContainer = document.getElementById("preview-ad-badge-container");
  const statusElem = document.getElementById("preview-modal-status");
  const dateElem = document.getElementById("preview-modal-date");
  const aeElem = document.getElementById("preview-modal-ae");
  const soElem = document.getElementById("preview-modal-so");
  const qtyElem = document.getElementById("preview-modal-qty");
  const notesElem = document.getElementById("preview-modal-notes");
  const actionsContainer = document.getElementById("preview-modal-actions");
  const counterElem = document.getElementById("preview-modal-counter");
  
  if (!mediaContainer || !titleElem) return;
  
  const ad = medsosSpotlightAds[medsosSpotlightIndex];
  if (!ad) return;

  // Counter
  counterElem.textContent = `${medsosSpotlightIndex + 1} / ${medsosSpotlightAds.length}`;
  
  // Title & Status
  titleElem.textContent = ad.judul || 'Untitled Ad';
  
  const platformInfo = getPlatformInfo(ad.posisi);
  badgeContainer.innerHTML = `<span class="ad-badge ${platformInfo.badgeClass}" style="font-size: 10px; font-weight: 700;">${platformInfo.label}</span>`;
  
  // Compute today's date string
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const isPublished = ad.tgl_terbit && ad.tgl_terbit <= todayStr;
  
  statusElem.textContent = isPublished ? "Sudah Tayang" : "Terjadwal";
  statusElem.className = `ad-badge ${isPublished ? 'badge-other' : 'badge-ig-story'}`; 
  if (isPublished) {
    statusElem.style.backgroundColor = "var(--success-glow)";
    statusElem.style.color = "var(--success)";
  } else {
    statusElem.style.backgroundColor = "var(--accent-gold-glow)";
    statusElem.style.color = "var(--accent-gold)";
  }

  // Metadata
  let dateStr = ad.tgl_terbit || "";
  if (dateStr.includes('-')) {
    const pts = dateStr.split('-');
    if (pts.length === 3) dateStr = `${pts[2]} / ${pts[1]} / ${pts[0]}`;
  }
  
  dateElem.innerHTML = `<strong>Tgl Terbit:</strong> ${dateStr}`;
  aeElem.innerHTML = `<strong>AE/CP:</strong> ${ad.ae || '-'}`;
  soElem.innerHTML = `<strong>SO ID:</strong> ${ad.so || '-'}`;
  qtyElem.innerHTML = `<strong>Qty:</strong> ${ad.total_ad || 1} Unit`;
  notesElem.innerHTML = `<strong>Keterangan Bahan:</strong> ${ad.keterangan || '-'}`;
  
  // Actions
  let linkUrl = null;
  if (ad.keterangan) {
    const match = ad.keterangan.match(/(https?:\/\/[^\s]+)/i);
    if (match) linkUrl = match[1];
  }
  
  let openBtnHtml = linkUrl
    ? `<a href="${linkUrl}" target="_blank" class="primary-btn" style="flex-grow: 1; justify-content: center; padding: 10px 16px; font-size: 13px;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka Tautan</a>`
    : `<button class="action-btn" style="flex-grow: 1; justify-content: center;" disabled><i class="fa-solid fa-link-slash"></i> Tautan Kosong</button>`;
    
  let editBtnHtml = "";
  if (isAdminLoggedIn) {
    editBtnHtml = `
      <button class="action-btn edit-btn" style="padding: 10px 16px; color: var(--accent-gold); border-color: var(--accent-gold); background: var(--accent-gold-glow);" onclick="closePreviewModal(); editRowNotes('${(ad.keterangan || '').replace(/'/g, "\\'")}', '${ad.row_idx}')" title="Edit Link / Keterangan Bahan">
        <i class="fa-solid fa-pen-to-square"></i> Edit
      </button>`;
  }
  
  actionsContainer.innerHTML = `${openBtnHtml} ${editBtnHtml}`;
  
  // Smart Media Detection
  const DEMO_LINKS = {
    "bsi": { type: "video", url: "https://assets.mixkit.co/videos/preview/mixkit-bank-building-with-columns-in-a-city-43183-large.mp4", thumbnail: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop" },
    "djarum": { type: "image", url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop" },
    "rolex": { type: "image", url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop" },
    "cgv": { type: "video", url: "https://www.w3schools.com/html/movie.mp4", thumbnail: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop" },
    "lottemart": { type: "image", url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop" },
    "dyandra": { type: "video", url: "https://www.w3schools.com/html/mov_bbb.mp4", thumbnail: "https://images.unsplash.com/photo-1508962914676-134849a727f0?w=800&auto=format&fit=crop" },
    "pluang": { type: "image", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop" },
    "pegadaian": { type: "image", url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop" }
  };
  
  function detectMedia(url) {
    if (!url) return { type: "none", embedUrl: null, openUrl: null };
    const igPost = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_\-]+)/i);
    if (igPost) return { type: "ig-embed", embedUrl: `https://www.instagram.com/${igPost[1]}/${igPost[2]}/embed`, openUrl: url };
    const ytWatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_\-]+)/i);
    if (ytWatch) return { type: "yt-embed", embedUrl: `https://www.youtube.com/embed/${ytWatch[1]}`, openUrl: url };
    const tkMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
    if (tkMatch) return { type: "tk-embed", embedUrl: `https://www.tiktok.com/embed/v2/${tkMatch[1]}`, openUrl: url };
    const fbMatch = url.match(/facebook\.com\//i);
    if (fbMatch) return { type: "fb-embed", embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=500`, openUrl: url };
    const twMatch = url.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/i);
    if (twMatch) return { type: "tw-embed", embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${twMatch[1]}`, openUrl: url };
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return { type: "video", embedUrl: url, openUrl: url };
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return { type: "image", embedUrl: url, openUrl: url };
    return { type: "link", embedUrl: null, openUrl: url };
  }
  
  const detected = detectMedia(linkUrl);
  let mediaType = detected.type;
  let mediaUrl  = detected.openUrl;
  let embedUrl  = detected.embedUrl;
  let mediaThumbnail = null;
  
  const titleLower = (ad.judul || "").toLowerCase();
  
  if (mediaType === "none") {
    for (const [key, val] of Object.entries(DEMO_LINKS)) {
      if (titleLower.includes(key)) {
        mediaType    = val.type;
        mediaUrl     = val.url;
        embedUrl     = val.url;
        mediaThumbnail = val.thumbnail || null;
        break;
      }
    }
  }
  
  let mediaHtml = "";
  if (mediaType === "ig-embed" || mediaType === "yt-embed" || mediaType === "tk-embed" || mediaType === "fb-embed" || mediaType === "tw-embed") {
    mediaHtml = `
      <iframe
        src="${embedUrl}"
        style="width:100%; height:100%; border:none; display:block;"
        frameborder="0"
        scrolling="auto"
        allowtransparency="true"
        allow="autoplay; encrypted-media"
        loading="lazy"
      ></iframe>`;
  } else if (mediaType === "video") {
    mediaHtml = `<video src="${embedUrl}" controls poster="${mediaThumbnail || ''}" style="width:100%; height:100%; object-fit:contain; background:#000;"></video>`;
  } else if (mediaType === "image") {
    mediaHtml = `<img src="${embedUrl}" alt="${ad.judul}" style="width:100%; height:100%; object-fit:contain; background:#000;">`;
  } else {
    let placeholderBg = "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
    let platformIcon = "fa-solid fa-photo-film";
    if (platformInfo.label.includes("IG") || platformInfo.label.includes("Instagram")) {
      placeholderBg = "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)";
      platformIcon = "fa-brands fa-instagram";
    } else if (platformInfo.label.includes("X") || platformInfo.label.includes("Twitter")) {
      placeholderBg = "linear-gradient(135deg, #14171A 0%, #000000 100%)";
      platformIcon = "fa-brands fa-x-twitter";
    } else if (platformInfo.label.includes("Youtube")) {
      placeholderBg = "linear-gradient(135deg, #FF0000 0%, #280000 100%)";
      platformIcon = "fa-brands fa-youtube";
    } else if (platformInfo.label.includes("Facebook")) {
      placeholderBg = "linear-gradient(135deg, #1877F2 0%, #0A3D80 100%)";
      platformIcon = "fa-brands fa-facebook";
    } else if (platformInfo.label.toLowerCase().includes("tiktok")) {
      placeholderBg = "linear-gradient(135deg, #010101 0%, #69C9D0 100%)";
      platformIcon = "fa-brands fa-tiktok";
    }
    const linkLabel = mediaType === "link" ? "Klik untuk Buka Tautan" : "Belum Ada Link Bahan";
    mediaHtml = `
      <div class="ad-media-placeholder" style="background: ${placeholderBg}; color: white; height:100%; width:100%;">
        <i class="${platformIcon}" style="font-size: 56px;"></i>
        <span class="ad-placeholder-text" style="font-size: 13px;">${linkLabel}</span>
      </div>`;
  }
  
  mediaContainer.innerHTML = mediaHtml;
}
window.renderPreviewModalCard = renderPreviewModalCard;

// Open Bukti Tayang For Ad Trigger
window.openBuktiTayangForAd = function(rowIdx, tgl_terbit) {
  // Populate medsosSpotlightAds list for the active month
  const monthData = WORKING_DATA[currentMonth] || [];
  const allSocialAds = monthData.filter(ad => ad.tgl_terbit && ad.posisi && ad.judul);
  
  if (selectedDayNum !== null) {
    const mInfo = getMonthYearFromSheetName(currentMonth);
    const mm = String(mInfo.month + 1).padStart(2, '0');
    const dd = String(selectedDayNum).padStart(2, '0');
    const targetDate = `${mInfo.year}-${mm}-${dd}`;
    medsosSpotlightAds = allSocialAds.filter(ad => ad.tgl_terbit === targetDate);
  } else {
    medsosSpotlightAds = allSocialAds;
  }
  
  const targetIndex = medsosSpotlightAds.findIndex(ad => String(ad.row_idx) === String(rowIdx));
  if (targetIndex !== -1) {
    medsosSpotlightIndex = targetIndex;
    openPreviewModal(targetIndex);
  } else {
    // If not found in date-filtered list, try finding in all month's ads
    const allTargetIndex = allSocialAds.findIndex(ad => String(ad.row_idx) === String(rowIdx));
    if (allTargetIndex !== -1) {
      medsosSpotlightAds = allSocialAds;
      medsosSpotlightIndex = allTargetIndex;
      openPreviewModal(allTargetIndex);
    } else {
      showToast("Bukti tayang untuk iklan ini tidak ditemukan di bulan ini.", "warning");
    }
  }
};

// Render a single ad spotlight card at current index
function renderSpotlightCard() {
  const cardArea = document.getElementById("spotlight-card-area");
  const counter = document.getElementById("spotlight-counter");
  if (!cardArea || !counter) return;

  const total = medsosSpotlightAds.length;
  counter.textContent = `${medsosSpotlightIndex + 1} / ${total}`;

  const ad = medsosSpotlightAds[medsosSpotlightIndex];

  // Compute today's date string
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  const DEMO_LINKS = {
    "bsi": { type: "video", url: "https://assets.mixkit.co/videos/preview/mixkit-bank-building-with-columns-in-a-city-43183-large.mp4", thumbnail: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop" },
    "djarum": { type: "image", url: "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop" },
    "rolex": { type: "image", url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop" },
    "cgv": { type: "video", url: "https://www.w3schools.com/html/movie.mp4", thumbnail: "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800&auto=format&fit=crop" },
    "lottemart": { type: "image", url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop" },
    "dyandra": { type: "video", url: "https://www.w3schools.com/html/mov_bbb.mp4", thumbnail: "https://images.unsplash.com/photo-1508962914676-134849a727f0?w=800&auto=format&fit=crop" },
    "pluang": { type: "image", url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&auto=format&fit=crop" },
    "pegadaian": { type: "image", url: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800&auto=format&fit=crop" }
  };

  // Parse link from keterangan
  let linkUrl = null;
  if (ad.keterangan) {
    const match = ad.keterangan.match(/(https?:\/\/[^\s]+)/i);
    if (match) linkUrl = match[1];
  }

  const titleLower = (ad.judul || "").toLowerCase();
  let mediaThumbnail = null;

  // ── Smart Media Detection ──────────────────────────────────────────────
  // Returns { type, embedUrl, openUrl } based on link URL
  function detectMedia(url) {
    if (!url) return { type: "none", embedUrl: null, openUrl: null };

    // Instagram post/reel: https://www.instagram.com/p/CODE/ or /reel/CODE/
    const igPost = url.match(/instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_\-]+)/i);
    if (igPost) {
      return {
        type: "ig-embed",
        embedUrl: `https://www.instagram.com/${igPost[1]}/${igPost[2]}/embed`,
        openUrl: url
      };
    }

    // YouTube: watch?v=ID or youtu.be/ID or shorts/ID
    const ytWatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_\-]+)/i);
    if (ytWatch) {
      return {
        type: "yt-embed",
        embedUrl: `https://www.youtube.com/embed/${ytWatch[1]}`,
        openUrl: url
      };
    }

    // TikTok: https://www.tiktok.com/@user/video/ID
    const tkMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
    if (tkMatch) {
      return {
        type: "tk-embed",
        embedUrl: `https://www.tiktok.com/embed/v2/${tkMatch[1]}`,
        openUrl: url
      };
    }

    // Facebook post/video
    const fbMatch = url.match(/facebook\.com\//i);
    if (fbMatch) {
      return {
        type: "fb-embed",
        embedUrl: `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(url)}&show_text=true&width=500`,
        openUrl: url
      };
    }

    // Twitter/X post
    const twMatch = url.match(/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/i);
    if (twMatch) {
      return {
        type: "tw-embed",
        embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${twMatch[1]}`,
        openUrl: url
      };
    }

    // Direct video file
    const ext = url.split('?')[0].split('.').pop().toLowerCase();
    if (['mp4', 'webm', 'ogg', 'mov'].includes(ext)) return { type: "video", embedUrl: url, openUrl: url };

    // Direct image file
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return { type: "image", embedUrl: url, openUrl: url };

    // Generic link (unknown type)
    return { type: "link", embedUrl: null, openUrl: url };
  }

  const detected = detectMedia(linkUrl);
  let mediaType = detected.type;
  let mediaUrl  = detected.openUrl;
  let embedUrl  = detected.embedUrl;

  // Fallback to demo data if no link was provided
  if (mediaType === "none") {
    for (const [key, val] of Object.entries(DEMO_LINKS)) {
      if (titleLower.includes(key)) {
        mediaType    = val.type;
        mediaUrl     = val.url;
        embedUrl     = val.url;
        mediaThumbnail = val.thumbnail || null;
        break;
      }
    }
  }

  const platformInfo = getPlatformInfo(ad.posisi);

  let mediaHtml = "";
  if (mediaType === "ig-embed" || mediaType === "yt-embed" || mediaType === "tk-embed" || mediaType === "fb-embed" || mediaType === "tw-embed") {
    // Embedded iframe for social platform posts
    mediaHtml = `
      <iframe
        src="${embedUrl}"
        style="width:100%; height:100%; border:none; display:block;"
        frameborder="0"
        scrolling="auto"
        allowtransparency="true"
        allow="autoplay; encrypted-media"
        loading="lazy"
      ></iframe>`;
  } else if (mediaType === "video") {
    mediaHtml = `<video src="${embedUrl}" controls poster="${mediaThumbnail || ''}" style="width:100%; height:100%; object-fit:contain; background:#000;"></video>`;
  } else if (mediaType === "image") {
    mediaHtml = `<img src="${embedUrl}" alt="${ad.judul}" style="width:100%; height:100%; object-fit:contain; background:#000;">`;
  } else {
    let placeholderBg = "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)";
    let platformIcon = "fa-solid fa-photo-film";
    if (platformInfo.label.includes("IG") || platformInfo.label.includes("Instagram")) {
      placeholderBg = "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)";
      platformIcon = "fa-brands fa-instagram";
    } else if (platformInfo.label.includes("X") || platformInfo.label.includes("Twitter")) {
      placeholderBg = "linear-gradient(135deg, #14171A 0%, #000000 100%)";
      platformIcon = "fa-brands fa-x-twitter";
    } else if (platformInfo.label.includes("Youtube")) {
      placeholderBg = "linear-gradient(135deg, #FF0000 0%, #280000 100%)";
      platformIcon = "fa-brands fa-youtube";
    } else if (platformInfo.label.includes("Facebook")) {
      placeholderBg = "linear-gradient(135deg, #1877F2 0%, #0A3D80 100%)";
      platformIcon = "fa-brands fa-facebook";
    } else if (platformInfo.label.toLowerCase().includes("tiktok")) {
      placeholderBg = "linear-gradient(135deg, #010101 0%, #69C9D0 100%)";
      platformIcon = "fa-brands fa-tiktok";
    }
    const linkLabel = mediaType === "link" ? "Klik untuk Buka Tautan" : "Belum Ada Link Bahan";
    mediaHtml = `
      <div class="ad-media-placeholder" style="background: ${placeholderBg}; color: white; height:100%;">
        <i class="${platformIcon}" style="font-size: 56px;"></i>
        <span class="ad-placeholder-text" style="font-size: 13px;">${linkLabel}</span>
      </div>`;
  }

  const isPublished = ad.tgl_terbit && ad.tgl_terbit <= todayStr;
  const statusText = isPublished ? "Sudah Tayang" : "Terjadwal";
  const statusClass = isPublished ? "" : "scheduled";

  let dateStr = ad.tgl_terbit || "";
  if (dateStr.includes('-')) {
    const pts = dateStr.split('-');
    if (pts.length === 3) dateStr = `${pts[2]} / ${pts[1]}`;
  }

  let openBtnHtml = mediaUrl
    ? `<a href="${mediaUrl}" target="_blank" class="ad-card-action-btn"><i class="fa-solid fa-arrow-up-right-from-square"></i> Buka Tautan</a>`
    : `<button class="ad-card-action-btn" disabled><i class="fa-solid fa-link-slash"></i> Tautan Kosong</button>`;

  let editBtnHtml = "";
  if (isAdminLoggedIn) {
    editBtnHtml = `
      <button class="ad-card-action-btn edit-btn" onclick="editRowNotes('${(ad.keterangan || '').replace(/'/g, "\\'")}', '${ad.row_idx}')" title="Edit Link / Keterangan Bahan">
        <i class="fa-solid fa-pen-to-square"></i>
      </button>`;
  }

  cardArea.innerHTML = `
    <div class="spotlight-card" style="animation: spotlightFadeIn 0.35s ease;">
      <div class="spotlight-media">
        <span class="ad-card-status-badge ${statusClass}">${statusText}</span>
        ${mediaHtml}
      </div>
      <div class="spotlight-info">
        <div class="spotlight-title-row">
          <h3 class="spotlight-title">${ad.judul || 'Untitled Ad'}</h3>
          <span class="ad-badge ${platformInfo.badgeClass}" style="white-space: nowrap; font-size: 9px;">${platformInfo.label}</span>
        </div>
        <div class="spotlight-meta-grid">
          <div class="spotlight-meta-item">
            <i class="fa-solid fa-calendar-day"></i>
            <span>${dateStr}</span>
          </div>
          <div class="spotlight-meta-item">
            <i class="fa-solid fa-user-tie"></i>
            <span>${ad.ae || '-'}</span>
          </div>
          <div class="spotlight-meta-item">
            <i class="fa-solid fa-receipt"></i>
            <span>SO: ${ad.so || '-'}</span>
          </div>
          <div class="spotlight-meta-item">
            <i class="fa-solid fa-layer-group"></i>
            <span>Qty: ${ad.total_ad || 1}</span>
          </div>
          <div class="spotlight-meta-item" style="grid-column: 1 / -1; color: var(--text-muted); font-size: 10px;" title="${ad.keterangan || ''}">
            <i class="fa-solid fa-info-circle"></i>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${ad.keterangan || '-'}</span>
          </div>
        </div>
        <div class="spotlight-actions">
          ${openBtnHtml}
          ${editBtnHtml}
        </div>
      </div>
    </div>
  `;
}
window.renderSpotlightCard = renderSpotlightCard;

// Edit specific ad notes/link inline (Admin authorization required)
function editRowNotes(currentNotes, rowIdx) {
  if (!isAdminLoggedIn) {
    showToast("Harap login sebagai Admin untuk mengubah keterangan / link!", "error");
    return;
  }
  
  const newNotes = prompt(`Masukkan Link Bahan atau Keterangan Tambahan Baru untuk Baris #${rowIdx}:\n(Link bahan berupa URL gambar/video akan langsung memunculkan preview visual)`, currentNotes);
  
  if (newNotes === null) return; // Prompt cancelled
  
  const notesToSend = newNotes.trim();
  
  if (isServerEnv) {
    showToast("Menyimpan keterangan baru ke Excel...", "success");
    
    fetch('/api/edit-notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': adminPassword
      },
      body: JSON.stringify({
        notes: notesToSend,
        sheet_name: currentMonth,
        row_idx: rowIdx
      })
    })
    .then(res => {
      if (res.status === 401) {
        throw new Error("Akses Ditolak! Sesi Admin kedaluwarsa.");
      }
      if (!res.ok) {
        return res.text().then(text => {
          let errMsg = "Gagal mengubah keterangan di Excel.";
          try {
            const errData = JSON.parse(text);
            errMsg = errData.message || errMsg;
          } catch(e) {
            errMsg = text || errMsg;
          }
          throw new Error(errMsg);
        });
      }
      return res.json();
    })
    .then(resData => {
      showToast(resData.message || "Keterangan berhasil disimpan ke Excel!", "success");
      
      // Dynamic reload dataset from server to sync state
      return fetch('/api/data?t=' + Date.now())
        .then(res => {
          if (!res.ok) {
            return res.text().then(text => { throw new Error(text || `HTTP Error ${res.status}`); });
          }
          return res.json();
        })
        .then(data => {
          WORKING_DATA = data;
          renderTable();
          renderCalendar();
          if (document.getElementById("tab-omset") && document.getElementById("tab-omset").classList.contains("active")) {
            renderMedsosGallery();
          }
        });
    })
    .catch(err => {
      console.error(err);
      showToast(getCleanErrorMessage(err, "Gagal mengubah keterangan di server."), "error");
    });
    
  } else {
    // Static Fallback Mode edit (In-Memory Session)
    const monthData = WORKING_DATA[currentMonth] || [];
    const targetAd = monthData.find(item => item.row_idx == rowIdx);
    
    if (targetAd) {
      targetAd.keterangan = notesToSend;
      showToast("Offline Mode: Keterangan diperbarui di memori browser!", "success");
      renderTable();
      renderCalendar();
      if (document.getElementById("tab-omset") && document.getElementById("tab-omset").classList.contains("active")) {
        renderMedsosGallery();
      }
    } else {
      showToast("Iklan pada baris tersebut tidak ditemukan!", "error");
    }
  }
}
window.editRowNotes = editRowNotes;

// Render visual calendar layouts with scheduled ad dots
function renderCalendar() {
  const monthData = WORKING_DATA[currentMonth] || [];
  const calendarGrid = document.getElementById("calendar-days-grid");
  calendarGrid.innerHTML = "";
  
  const mInfo = getMonthYearFromSheetName(currentMonth);
  document.getElementById("calendar-month-indicator").textContent = currentMonth;
  
  // Determine days in that selected month
  const totalDays = new Date(mInfo.year, mInfo.month + 1, 0).getDate();
  const startDayOfWeek = new Date(mInfo.year, mInfo.month, 1).getDay(); // 0 is Sunday, 6 is Saturday
  
  // Group ads for this month by Day
  const adsByDay = {};
  monthData.forEach(item => {
    const day = getDayFromDate(item.tgl_terbit);
    if (day) {
      if (!adsByDay[day]) adsByDay[day] = [];
      adsByDay[day].push(item);
    }
  });
  
  // 1. Render empty grid cell spacers for previous month padding offset
  for (let s = 0; s < startDayOfWeek; s++) {
    const space = document.createElement("div");
    space.className = "calendar-day-cell other-month";
    calendarGrid.appendChild(space);
  }
  
  // 2. Render each day grid cell in that month
  for (let d = 1; d <= totalDays; d++) {
    const cell = document.createElement("div");
    cell.className = "calendar-day-cell";
    
    // Check if cell corresponds to active clicked day
    if (selectedDayNum === d) {
      cell.classList.add("active-day");
    }
    
    const dayHeader = document.createElement("div");
    dayHeader.style.display = "flex";
    dayHeader.style.justifyContent = "space-between";
    dayHeader.style.width = "100%";
    
    const dayNum = document.createElement("span");
    dayNum.className = "day-number";
    dayNum.textContent = d;
    dayHeader.appendChild(dayNum);
    
    const dayAds = adsByDay[d] || [];
    
    if (dayAds.length > 0) {
      cell.classList.add("has-ads");
      const badge = document.createElement("span");
      badge.className = "day-ad-count";
      badge.textContent = dayAds.length;
      dayHeader.appendChild(badge);
    }
    cell.appendChild(dayHeader);
    
    // Render color dots representation of active scheduled items
    const dotWrapper = document.createElement("div");
    dotWrapper.className = "ad-dots-container";
    
    // Cap dots visible on grid cell to avoid container blow-ups (max 6 dots)
    const displayAds = dayAds.slice(0, 6);
    displayAds.forEach(ad => {
      const dot = document.createElement("div");
      dot.className = "ad-dot";
      dot.style.backgroundColor = getPlatformInfo(ad.posisi).color;
      dot.title = `${ad.judul} - ${ad.posisi}`;
      dotWrapper.appendChild(dot);
    });
    
    if (dayAds.length > 6) {
      const moreText = document.createElement("span");
      moreText.style.fontSize = "8px";
      moreText.style.color = "var(--text-muted)";
      moreText.style.fontWeight = "bold";
      moreText.textContent = `+${dayAds.length - 6}`;
      dotWrapper.appendChild(moreText);
    }
    cell.appendChild(dotWrapper);
    
    // Add Click listener to populate Sidebar details drawer panel (decoupled from main data table)
    cell.addEventListener("click", () => {
      if (selectedDayNum === d) {
        // Deselect when clicked again
        selectedDayNum = null;
        cell.classList.remove("active-day");
        
        // Reset sidebar drawer back to empty state
        const drawerAdList = document.getElementById("drawer-ad-list");
        const drawerDateHeading = document.getElementById("drawer-date-heading");
        const drawerDateSubheading = document.getElementById("drawer-date-subheading");
        
        drawerDateHeading.textContent = "Pilih Tanggal";
        drawerDateSubheading.textContent = "Silakan klik tanggal pada kalender untuk melihat detail iklan";
        drawerAdList.innerHTML = `
          <div class="empty-ad-state">
            <div class="empty-ad-icon"><i class="fa-solid fa-calendar-check"></i></div>
            <p>Pilih tanggal pada kalender untuk memantau jadwal penempatan secara rinci</p>
          </div>
        `;

        // Reset Bukti Tayang Iklan spotlight to show all ads of the month
        const adsGalleryGridReset = document.getElementById("ads-gallery-grid");
        if (adsGalleryGridReset) renderMedsosGallery();
      } else {
        selectedDayNum = d;
        
        // Update cell visual select active ring borders
        document.querySelectorAll(".calendar-day-cell").forEach(c => c.classList.remove("active-day"));
        cell.classList.add("active-day");
        
        renderDayDetailDrawer(d, dayAds);

        // Sync Bukti Tayang Iklan spotlight to selected date
        const adsGalleryGrid = document.getElementById("ads-gallery-grid");
        if (adsGalleryGrid) renderMedsosGallery();
      }
    });
    
    calendarGrid.appendChild(cell);
  }
}

// Display day-by-day scheduled details in visual sidebar listing drawer
function renderDayDetailDrawer(dayNum, dayAds) {
  const drawerAdList = document.getElementById("drawer-ad-list");
  const drawerDateHeading = document.getElementById("drawer-date-heading");
  const drawerDateSubheading = document.getElementById("drawer-date-subheading");
  
  // Format Date presentation heading
  const dateFormatted = `${dayNum} ${currentMonth}`;
  drawerDateHeading.textContent = `Jadwal: ${dateFormatted}`;
  drawerDateSubheading.textContent = `${dayAds.length} Iklan dijadwalkan terbit`;
  
  drawerAdList.innerHTML = "";
  
  if (dayAds.length === 0) {
    drawerAdList.innerHTML = `
      <div class="empty-ad-state">
        <div class="empty-ad-icon"><i class="fa-solid fa-calendar-check" style="color:var(--success)"></i></div>
        <p>Tidak ada iklan dijadwalkan publikasi pada tanggal ini.</p>
      </div>
    `;
    return;
  }
  
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  dayAds.forEach(ad => {
    const item = document.createElement("div");
    item.className = "drawer-ad-item";
    item.style.cursor = "pointer";
    item.onclick = function() { openBuktiTayangForAd(ad.row_idx, ad.tgl_terbit || ''); };
    
    const info = getPlatformInfo(ad.posisi);
    
    // Check if the ad has already been published (sudah tayang) compared to today's date
    const isPublished = ad.tgl_terbit && ad.tgl_terbit <= todayStr;
    
    // Highlight customized left-border representing color of platform
    // If it's already published and the color is blue/cyan, change it to green (var(--success))
    let borderLeftColor = info.color;
    if (isPublished && (info.color === '#06b6d4' || info.color === '#0ea5e9' || info.color === '#3b82f6')) {
      borderLeftColor = 'var(--success)';
    }
    item.style.borderLeft = `4px solid ${borderLeftColor}`;
    
    const memoVal = ad.keterangan_order || '';
    let hasMemo = memoVal && memoVal !== '-';
    
    if (isServerEnv && hasMemo && typeof AVAILABLE_MEMOS !== 'undefined') {
      const match = memoVal.match(/\b(\d+)\b/) || memoVal.match(/(\d+)/);
      if (match) {
        const prefix = match[1];
        hasMemo = AVAILABLE_MEMOS.includes(prefix) || AVAILABLE_MEMOS.includes(String(parseInt(prefix, 10)));
      } else {
        hasMemo = false;
      }
    } else if (!isServerEnv && hasMemo && typeof MEMO_MAP !== 'undefined') {
      const match = memoVal.match(/\b(\d+)\b/) || memoVal.match(/(\d+)/);
      if (match) {
        const prefix = match[1];
        hasMemo = !!(MEMO_MAP[prefix] || MEMO_MAP[String(parseInt(prefix, 10))]);
      } else {
        hasMemo = false;
      }
    }

    let dateStr = ad.tgl_terbit || "";
    if (dateStr.includes('-')) {
      const pts = dateStr.split('-');
      if (pts.length === 3) {
        dateStr = `${pts[2]} / ${pts[1]}`;
      }
    }
    
    let drawerSoContent = ad.so || '-';
    if (ad.so && ad.so !== '-') {
      const isCustomPrice = ad.pendapatan !== "" && !isNaN(ad.pendapatan);
      const rate = isCustomPrice ? parseFloat(ad.pendapatan) : (RATE_CARD[ad.posisi] || RATE_CARD["Default"]);
      if (isAdminLoggedIn) {
        drawerSoContent = `<a href="https://fastkom.kompas.com/Order?search=${ad.so}" target="_blank" class="so-link-badge" style="font-size: 10px; padding: 2px 6px;" title="Buka & Salin SO ke FastKom" onclick="handleSoClick(event, '${ad.so}', '${rate}', '${ad.row_idx}')"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${ad.so}</a>`;
      } else {
        drawerSoContent = `<span class="so-link-badge" style="font-size: 10px; padding: 2px 6px; cursor: default; opacity: 0.7; color: var(--text-muted); background: var(--bg-tertiary);" title="Nomor SO (Login Admin untuk membuka link)"><i class="fa-solid fa-lock"></i> ${ad.so}</span>`;
      }
    }

    const buttonClass = `download-memo-btn ${hasMemo ? '' : 'no-memo'} ${isPublished ? 'published' : ''}`;

    item.innerHTML = `
      <div class="drawer-ad-title" style="display:flex; justify-content:space-between; align-items:flex-start;">
        <span style="flex:1; padding-right:8px; line-height: 1.3;">${ad.judul || 'Untitled Ad'}</span>
        <button class="${buttonClass}" 
                style="padding: 3px 8px; font-size: 10px; min-width: unset; height: auto;"
                onclick="downloadMemo(event, '${(ad.keterangan_order || '').replace(/'/g, "\\'")}', '${(ad.judul || '').replace(/'/g, "\\'")}', '${ad.so || ''}', '${ad.posisi || ''}', '${ad.total_ad || 1}', '${dateStr}', '${(ad.ae || '').replace(/'/g, "\\'")}')" 
                title="${hasMemo ? 'Unduh file PDF memo' : 'Memo tidak tersedia'}"
                ${hasMemo ? '' : 'disabled'}>
          <i class="fa-solid fa-file-arrow-down"></i> Unduh Memo
        </button>
      </div>
      <div class="drawer-ad-meta">
        <span class="ad-badge ${info.badgeClass}" style="cursor:pointer;" onclick="openBuktiTayangForAd('${ad.row_idx}', '${ad.tgl_terbit || ''}')" title="Lihat Bukti Tayang">${info.label}</span>
        <span class="ae-badge">${ad.ae || 'No AE'}</span>
      </div>
      <div style="font-size:10px; color:var(--text-secondary); margin-top:4px;">
        <i class="fa-solid fa-circle-info"></i> ${ad.keterangan_order || 'No Order Memo'}
      </div>
      <div style="font-size:10px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; margin-top:6px; padding-top:6px; border-top:1px solid var(--glass-border);">
        <span>SO: <strong class="so-cell">${drawerSoContent}</strong></span>
        <span>Ad Qty: <strong>${ad.total_ad || 1}</strong></span>
      </div>
    `;
    drawerAdList.appendChild(item);
  });
}

// Smart Data Grid rendering with searches and column sort options
function renderTable() {
  // Determine which dataset to use: single month or omset range
  let baseData = [];
  if (omsetRangeMode && omsetRangeSheets.length > 0) {
    // Aggregate data from all sheets in range, each item gets a _period tag
    omsetRangeSheets.forEach(sheet => {
      const sheetData = WORKING_DATA[sheet] || [];
      sheetData.forEach(item => {
        baseData.push(Object.assign({}, item, { _period: sheet }));
      });
    });
  } else {
    baseData = WORKING_DATA[currentMonth] || [];
  }
  
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";

  // ── Range Mode Banner ────────────────────────────────────────────────────
  if (omsetRangeMode && omsetRangeSheets.length > 0) {
    const shortMonths = {'januari':'Jan','februari':'Feb','maret':'Mar','april':'Apr','mei':'Mei','juni':'Jun','juli':'Jul','agustus':'Agu','september':'Sep','oktober':'Okt','november':'Nov','desember':'Des'};
    const shorten = s => { const p = s.split(' '); return (shortMonths[p[0].toLowerCase()]||p[0])+' '+p[1]; };
    const first = shorten(omsetRangeSheets[0]);
    const last  = shorten(omsetRangeSheets[omsetRangeSheets.length - 1]);
    const label = first === last ? first : `${first} — ${last}`;
    const bannerRow = document.createElement("tr");
    bannerRow.innerHTML = `
      <td colspan="10" style="
        padding: 10px 18px; 
        background: linear-gradient(90deg, rgba(59,130,246,0.15) 0%, rgba(168,85,247,0.10) 100%);
        border-bottom: 2px solid var(--primary-light);
        text-align: left;
      ">
        <span style="font-size:13px; font-weight:700; color:var(--primary-light);">
          <i class="fa-solid fa-layer-group" style="margin-right:6px;"></i>
          Mode Rentang Aktif: <em style="font-style:normal;">${label}</em>
          &nbsp;·&nbsp;
          <span style="color:var(--text-secondary); font-weight:600;">${omsetRangeSheets.length} bulan · ${baseData.length} baris data</span>
        </span>
        <button onclick="resetOmsetRange()" style="
          float:right; 
          padding:3px 12px; 
          border-radius:20px;
          border:1.5px solid var(--primary-light);
          background:transparent;
          color:var(--primary-light);
          font-size:12px;
          font-weight:700;
          cursor:pointer;
          font-family:inherit;
        " title="Kembali ke tampilan bulan tunggal">
          <i class="fa-solid fa-rotate-left"></i> Reset ke Bulan ${currentMonth}
        </button>
      </td>
    `;
    tbody.appendChild(bannerRow);
  }
  // ────────────────────────────────────────────────────────────────────────
  
  // Check if any selection or filter is active (independent of calendar day selection)
  const isSelectionActive = (activeFilters.platform !== "") || 
                            (activeFilters.ae !== "") || 
                            (activeFilters.search !== "") ||
                            omsetRangeMode; // range mode always shows
  
  if (!isSelectionActive) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="10" class="empty-table-row" style="padding: 40px; text-align: center; color: var(--text-secondary);">
        <i class="fa-solid fa-hand-pointer" style="font-size:36px; display:block; margin-bottom:12px; color:var(--primary-light); opacity: 0.8; animation: pulse 2s infinite;"></i>
        <strong style="font-size: 15px; display: block; margin-bottom: 6px; color: var(--text-primary);">Data Outline Tersembunyi</strong>
        Silakan pilih Platform / AE, atau lakukan pencarian untuk menampilkan data outline iklan.
      </td>
    `;
    tbody.appendChild(emptyRow);
    return;
  }
  
  // Filter active dataset
  let filtered = baseData.filter(item => {

    
    // 1. Text Search filtering (matches fields title, SO, and AE)
    if (activeFilters.search) {
      const q = activeFilters.search.toLowerCase();
      const jud = (item.judul || "").toLowerCase();
      const pos = (item.posisi || "").toLowerCase();
      const ae = (item.ae || "").toLowerCase();
      const so = (item.so || "").toLowerCase();
      const memo = (item.keterangan_order || "").toLowerCase();
      
      if (!jud.includes(q) && !pos.includes(q) && !ae.includes(q) && !so.includes(q) && !memo.includes(q)) {
        return false;
      }
    }
    
    // 2. Platform Dropdown Filter
    if (activeFilters.platform) {
      const posLower = (item.posisi || "").toLowerCase();
      if (!posLower.includes(activeFilters.platform.toLowerCase())) {
        return false;
      }
    }
    
    // 3. AE Dropdown filter match
    if (activeFilters.ae) {
      if ((item.ae || "").trim() !== activeFilters.ae) {
        return false;
      }
    }
    
    return true;
  });
  
  // Perform sorting on filtered listings
  if (activeSort.column) {
    const col = activeSort.column;
    const dir = activeSort.direction === "asc" ? 1 : -1;
    
    filtered.sort((a, b) => {
      let valA = a[col] || "";
      let valB = b[col] || "";
      
      // Numeric or Date checks
      if (col === "total_ad") {
        return (parseInt(valA) - parseInt(valB)) * dir;
      }
      
      return String(valA).localeCompare(String(valB)) * dir;
    });
  }
  
  // Empty state visual rows drawing
  if (filtered.length === 0) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML = `
      <td colspan="10" class="empty-table-row" style="padding: 30px; text-align: center;">
        <i class="fa-solid fa-folder-open" style="font-size:32px; display:block; margin-bottom:10px; color:var(--text-muted)"></i>
        Tidak ada data outline ditemukan yang sesuai kriteria pencarian / filter Anda.
      </td>
    `;
    tbody.appendChild(emptyRow);
    return;
  }
  
  // ── Pagination: slice filtered to current page ───────────────────────────
  const totalRows  = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / ROWS_PER_PAGE));
  // Clamp currentPage
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const pageRows = filtered.slice(startIdx, startIdx + ROWS_PER_PAGE);
  // ────────────────────────────────────────────────────────────────────────

  // Render records rows (only current page)
  pageRows.forEach((ad, localIndex) => {
    const index = startIdx + localIndex;   // global index for numbering
    const tr = document.createElement("tr");
    const info = getPlatformInfo(ad.posisi);
    
    // In range mode: add a subtle left-border color per period
    if (omsetRangeMode && ad._period) {
      const periodIdx = omsetRangeSheets.indexOf(ad._period);
      const hue = (periodIdx * 47 + 200) % 360;
      tr.style.borderLeft = `3px solid hsl(${hue},70%,55%)`;
    }
    
    // Format tanggal — in range mode show full DD/MM/YYYY for clarity
    let dateStr = ad.tgl_terbit || "";
    if (dateStr.includes('-')) {
      const pts = dateStr.split('-');
      if (pts.length === 3) {
        dateStr = omsetRangeMode
          ? `${pts[2]}/${pts[1]}/${pts[0]}`  // DD/MM/YYYY in range mode
          : `${pts[2]} / ${pts[1]}`;          // Day / Month in single-month mode
      }
    }
    
    const memoVal = ad.keterangan_order || '';
    let hasMemo = memoVal && memoVal !== '-';
    
    // If running in a server-connected environment, check if the actual memo file exists in the directory!
    if (isServerEnv && hasMemo) {
      const prefixMatch = memoVal.match(/(\d+)/);
      if (prefixMatch) {
        const prefix = prefixMatch[1];
        // Checks both exact matches and conversions (e.g. "8" matching "008")
        hasMemo = AVAILABLE_MEMOS.includes(prefix) || AVAILABLE_MEMOS.includes(String(parseInt(prefix, 10)));
      } else {
        hasMemo = false;
      }
    } else if (!isServerEnv && hasMemo && typeof MEMO_MAP !== 'undefined') {
      const prefixMatch = memoVal.match(/(\d+)/);
      if (prefixMatch) {
        const prefix = prefixMatch[1];
        hasMemo = !!(MEMO_MAP[prefix] || MEMO_MAP[String(parseInt(prefix, 10))]);
      } else {
        hasMemo = false;
      }
    }
    
    let soContent = ad.so || '-';
    if (ad.so && ad.so !== '-') {
      const isCustomPrice = ad.pendapatan !== "" && !isNaN(ad.pendapatan);
      const rate = isCustomPrice ? parseFloat(ad.pendapatan) : (RATE_CARD[ad.posisi] || RATE_CARD["Default"]);
      if (isAdminLoggedIn) {
        soContent = `<a href="https://fastkom.kompas.com/Order?search=${ad.so}" target="_blank" class="so-link-badge" onclick="handleSoClick(event, '${ad.so}', '${rate}', '${ad.row_idx}')" title="Buka & Salin SO ke FastKom"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${ad.so}</a>`;
      } else {
        soContent = `<span class="so-link-badge" style="cursor: default; opacity: 0.7; color: var(--text-muted); background: var(--bg-tertiary);" title="Nomor SO (Login Admin untuk membuka link)"><i class="fa-solid fa-lock"></i> ${ad.so}</span>`;
      }
    }
    
    const editSoIcon = isAdminLoggedIn 
      ? `<i class="fa-solid fa-pen-to-square" onclick="editRowSO('${(ad.so || '').replace(/'/g, "\\'")}', '${ad.row_idx}')" style="margin-left: 6px; cursor: pointer; color: var(--text-muted); opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" title="Edit Nomor SO"></i>` 
      : "";

    tr.innerHTML = `
      <td style="color:var(--text-muted); font-weight:700;">${index + 1}</td>
      <td class="ad-title-cell">${ad.judul || '-'}</td>
      <td style="cursor:pointer;" onclick="openBuktiTayangForAd('${ad.row_idx}', '${ad.tgl_terbit || ''}')" title="Lihat Bukti Tayang">
        <span class="ad-badge ${info.badgeClass}">${ad.posisi || '-'}</span>
      </td>
      <td style="text-align:center; font-weight:700;">${ad.total_ad || 1}</td>
      <td style="font-weight:600; color:var(--text-secondary);">${dateStr}</td>
      <td>
        <span class="ae-badge" onclick="openAePerformanceModal('${(ad.ae || '').replace(/'/g, "\\'")}')" title="Klik untuk Analisis Kinerja ${ad.ae}">${ad.ae || '-'}</span>
      </td>
      <td style="font-size:12px; color:var(--text-secondary);">${ad.keterangan_order || '-'}</td>
      <td style="font-size:12px; color:var(--text-muted); max-width:240px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;" title="${ad.keterangan || ''}">
        ${ad.keterangan || '-'}
      </td>
      <td class="so-cell" style="vertical-align: middle;">${soContent} ${editSoIcon}</td>
      <td style="text-align:center;">
        <button class="download-memo-btn ${hasMemo ? '' : 'no-memo'}" 
                onclick="downloadMemo(event, '${(ad.keterangan_order || '').replace(/'/g, "\\'")}', '${(ad.judul || '').replace(/'/g, "\\'")}', '${ad.so || ''}', '${ad.posisi || ''}', '${ad.total_ad || 1}', '${dateStr}', '${(ad.ae || '').replace(/'/g, "\\'")}')" 
                title="${hasMemo ? 'Unduh file PDF memo' : 'Memo tidak tersedia'}"
                ${hasMemo ? '' : 'disabled'}>
          <i class="fa-solid fa-file-arrow-down"></i> Unduh Memo
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // Render pagination controls
  renderPagination(totalRows, totalPages);
}

// Render pagination bar below the table
function renderPagination(totalRows, totalPages) {
  const container = document.getElementById("table-pagination");
  if (!container) return;
  container.innerHTML = "";

  if (totalPages <= 1) return;   // No pagination needed for single page

  const startRow = (currentPage - 1) * ROWS_PER_PAGE + 1;
  const endRow   = Math.min(currentPage * ROWS_PER_PAGE, totalRows);

  // Info label
  const info = document.createElement("span");
  info.className = "pagination-info";
  info.innerHTML = `Menampilkan <strong>${startRow}–${endRow}</strong> dari <strong>${totalRows}</strong> data`;
  container.appendChild(info);

  // Controls wrapper
  const controls = document.createElement("div");
  controls.className = "pagination-controls";

  // Helper: create a page button
  const makeBtn = (label, page, isActive = false, isDisabled = false) => {
    const btn = document.createElement("button");
    btn.className = `pagination-btn${isActive ? ' active' : ''}${isDisabled ? ' disabled' : ''}`;
    btn.innerHTML = label;
    btn.disabled = isDisabled;
    if (!isDisabled && !isActive) {
      btn.addEventListener("click", () => {
        currentPage = page;
        renderTable();
        // Smooth scroll to table top
        const tableEl = document.getElementById("ad-data-table");
        if (tableEl) tableEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
    return btn;
  };

  // Prev button
  controls.appendChild(makeBtn('<i class="fa-solid fa-chevron-left"></i>', currentPage - 1, false, currentPage === 1));

  // Page number buttons with ellipsis logic
  const pageWindow = 2;  // pages to show around current
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || (p >= currentPage - pageWindow && p <= currentPage + pageWindow)) {
      controls.appendChild(makeBtn(p, p, p === currentPage));
    } else if (p === currentPage - pageWindow - 1 || p === currentPage + pageWindow + 1) {
      // Ellipsis
      const dots = document.createElement("span");
      dots.className = "pagination-dots";
      dots.textContent = "…";
      controls.appendChild(dots);
    }
  }

  // Next button
  controls.appendChild(makeBtn('<i class="fa-solid fa-chevron-right"></i>', currentPage + 1, false, currentPage === totalPages));

  container.appendChild(controls);
}

// Columns Sort sorting handlers
function toggleSort(column) {
  if (activeSort.column === column) {
    activeSort.direction = activeSort.direction === "asc" ? "desc" : "asc";
  } else {
    activeSort.column = column;
    activeSort.direction = "asc";
  }
  
  // Update icons indicator tags in the table headers
  const headers = ["judul", "posisi", "tgl", "ae", "so"];
  headers.forEach(h => {
    const icon = document.querySelector(`#sort-${h} i`);
    if (icon) {
      icon.className = "fa-solid fa-sort";
    }
  });
  
  const activeIcon = document.querySelector(`#sort-${column === 'tgl_terbit' ? 'tgl' : column} i`);
  if (activeIcon) {
    activeIcon.className = activeSort.direction === "asc" 
      ? "fa-solid fa-sort-up" 
      : "fa-solid fa-sort-down";
  }
  
  renderTable();
  showToast(`Tabel diurutkan berdasarkan ${column} (${activeSort.direction})`, "success");
}

// Convert table dataset into downloadable Excel CSV formats
function downloadOmsetAE() {
  if (!isAdminLoggedIn) {
    showToast("Akses Ditolak! Silakan hubungi Admin.", "error");
    return;
  }
  
  const startPeriod = document.getElementById("omset-start-period").value;
  const endPeriod = document.getElementById("omset-end-period").value;
  
  const monthOrder = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  
  const getSheetValue = (sheetName) => {
    if (!sheetName) return 0;
    const parts = sheetName.trim().split(/\s+/);
    if (parts.length === 2) {
      const monthIndex = monthOrder.map(m => m.toLowerCase()).indexOf(parts[0].toLowerCase());
      const yearVal = parseInt(parts[1], 10);
      if (monthIndex !== -1 && !isNaN(yearVal)) {
        return yearVal * 12 + monthIndex;
      }
    }
    return 0;
  };
  
  const startVal = getSheetValue(startPeriod);
  const endVal = getSheetValue(endPeriod);
  
  if (startVal > endVal) {
    showToast("Periode mulai tidak boleh melebihi periode selesai!", "error");
    return;
  }
  
  const selectedAE = document.getElementById("filter-ae").value;
  // If empty, it means "Semua AE"
  
  // Find all available sheets/periods that fall within the range
  const allSheets = Object.keys(WORKING_DATA);
  const matchingSheets = allSheets.filter(sheet => {
    const val = getSheetValue(sheet);
    return val >= startVal && val <= endVal;
  });
  
  // Sort the matching sheets chronologically
  matchingSheets.sort((a, b) => getSheetValue(a) - getSheetValue(b));
  
  if (matchingSheets.length === 0) {
    showToast("Tidak ada data untuk periode yang dipilih!", "error");
    return;
  }
  
  // Gather all AE ads across all matching sheets
  let aggregatedAds = [];
  matchingSheets.forEach(sheet => {
    const monthData = WORKING_DATA[sheet] || [];
    const filtered = selectedAE 
      ? monthData.filter(item => (item.ae || "").trim().toLowerCase() === selectedAE.trim().toLowerCase()) 
      : monthData;
      
    // Attach the period to each item for reference
    filtered.forEach(item => {
      // Create a shallow copy to avoid mutating the master WORKING_DATA objects
      const itemCopy = Object.assign({}, item);
      itemCopy._period = sheet;
      aggregatedAds.push(itemCopy);
    });
  });
  
  const aeLabel = selectedAE ? `AE ${selectedAE}` : "Semua AE";
  
  if (aggregatedAds.length === 0) {
    showToast(`Tidak ada data iklan untuk ${aeLabel} pada periode terpilih!`, "error");
    return;
  }
  
  // Create CSV Content
  let csvContent = "PERIODE,TANGGAL,JUDUL IKLAN,POSISI / SALURAN,TOTAL AD,SALES ORDER (SO),AE,ESTIMASI PENDAPATAN (RP)\n";
  
  let totalRevenue = 0;
  
  aggregatedAds.forEach(item => {
    const isCustomPrice = item.pendapatan !== undefined && item.pendapatan !== "" && !isNaN(item.pendapatan);
    const rate = isCustomPrice ? parseFloat(item.pendapatan) : (RATE_CARD[item.posisi] || RATE_CARD["Default"]);
    const qty = parseInt(item.total_ad) || 1;
    const itemRevenue = qty * rate;
    totalRevenue += itemRevenue;
    
    let dateStr = item.tgl_terbit || "";
    if (dateStr.includes('-')) {
      const pts = dateStr.split('-');
      if (pts.length === 3) {
        dateStr = `${pts[2]} / ${pts[1]} / ${pts[0]}`;
      }
    }
    
    const row = [
      `"${item._period}"`,
      `"${dateStr}"`,
      `"${(item.judul || "").replace(/"/g, '""')}"`,
      `"${(item.posisi || "").replace(/"/g, '""')}"`,
      qty,
      `"${(item.so || "").replace(/"/g, '""')}"`,
      `"${(item.ae || "").replace(/"/g, '""')}"`,
      itemRevenue
    ];
    csvContent += row.join(",") + "\n";
  });
  
  csvContent += `,,,,,,,"TOTAL OMSET",${totalRevenue}\n`;
  
  // Robust modern download using Blob to avoid length limit or special character encoding issues
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  
  const shortMonthsMap = {
    'januari': 'Jan', 'februari': 'Feb', 'maret': 'Mar', 'april': 'Apr', 'mei': 'Mei', 'juni': 'Jun',
    'juli': 'Jul', 'agustus': 'Agu', 'september': 'Sep', 'oktober': 'Okt', 'november': 'Nov', 'desember': 'Des'
  };
  const shortenSheet = (sheetName) => {
    const parts = sheetName.split(' ');
    if (parts.length === 2) {
      const mStr = parts[0].toLowerCase();
      const yStr = parts[1];
      if (mStr in shortMonthsMap) {
        return `${shortMonthsMap[mStr]}_${yStr}`;
      }
    }
    return sheetName.replace(/\s+/g, '_');
  };
  
  let periodLabel = shortenSheet(startPeriod);
  if (startVal !== endVal) {
    periodLabel += `_to_${shortenSheet(endPeriod)}`;
  }
  
  const filenameAe = selectedAE ? selectedAE.replace(/\s+/g, '_') : "Semua_AE";
  const filename = `Omset_${filenameAe}_${periodLabel}.csv`;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  const shortenFull = (sheetName) => {
    const parts = sheetName.split(' ');
    if (parts.length === 2) {
      const mStr = parts[0].toLowerCase();
      const yStr = parts[1];
      if (mStr in shortMonthsMap) {
        return `${shortMonthsMap[mStr]} ${yStr}`;
      }
    }
    return sheetName;
  };
  
  const successMsg = startVal === endVal 
    ? `Data Omset ${aeLabel} periode ${shortenFull(startPeriod)} berhasil diunduh!`
    : `Data Omset ${aeLabel} periode ${shortenFull(startPeriod)} s/d ${shortenFull(endPeriod)} berhasil diunduh!`;
  showToast(successMsg, "success");
}

// Handle Add Outline Order Submit Events
function handleAddAdForm(e) {
  e.preventDefault();
  
  const judul = document.getElementById("form-judul").value.trim();
  const posisi = document.getElementById("form-posisi").value;
  const total = parseInt(document.getElementById("form-total").value, 10) || 1;
  const rawDate = document.getElementById("form-date").value; // Format: YYYY-MM-DD
  const ae = document.getElementById("form-ae").value.trim();
  const orderMemo = document.getElementById("form-order").value.trim();
  const notes = document.getElementById("form-notes").value.trim();
  const so = document.getElementById("form-so").value.trim();
  const price = document.getElementById("form-price").value.trim();
  
  if (!judul || !posisi || !rawDate || !ae || !so) {
    showToast("Harap lengkapi semua bidang bertanda bintang (*)", "error");
    return;
  }
  
  // Extract month and year from form date input to see which sheet it belongs to
  const dateObj = new Date(rawDate);
  if (isNaN(dateObj.getTime())) {
    showToast("Format tanggal terbit tidak valid!", "error");
    return;
  }
  
  const monthsIdNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const itemMonthStr = `${monthsIdNames[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
  
  const newAdItem = {
    judul: judul,
    posisi: posisi,
    total_ad: total,
    tgl_terbit: rawDate,
    ae: ae,
    keterangan_order: orderMemo,
    keterangan: notes,
    so: so,
    pendapatan: price
  };

  if (isServerEnv) {
    // Server Mode: Save directly to Excel file master
    showToast("Menyimpan ke berkas Excel...", "success");
    
    fetch('/api/add-ad', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': adminPassword
      },
      body: JSON.stringify(newAdItem)
    })
    .then(res => {
      if (res.status === 401) {
        // Admin authorization failed
        isAdminLoggedIn = false;
        adminPassword = "";
        sessionStorage.removeItem("isAdminLoggedIn");
        sessionStorage.removeItem("adminPassword");
        updateAdminUI();
        throw new Error("Akses Ditolak! Sesi Admin kedaluwarsa.");
      }
      if (!res.ok) {
        return res.json().then(errData => {
          throw new Error(errData.message || "Gagal menyimpan ke berkas Excel.");
        });
      }
      return res.json();
    })
    .then(resData => {
      showToast(resData.message || "Iklan berhasil disimpan permanen ke Excel!", "success");
      
      // Reset form and close dialog
      document.getElementById("ad-planner-form").reset();
      document.getElementById("ad-planner-modal").classList.remove("active");
      
      // Dynamic reload dataset from server to ensure perfect sync
      return fetch('/api/data?t=' + Date.now());
    })
    .then(res => {
      if (!res.ok) {
        return res.text().then(text => { throw new Error(text || `HTTP Error ${res.status}`); });
      }
      return res.json();
    })
    .then(data => {
      WORKING_DATA = data;
      
      // Update target sheet selection
      currentMonth = itemMonthStr;
      renderMonthTabs();
      loadMonthData();
    })
    .catch(err => {
      console.error(err);
      showToast(getCleanErrorMessage(err, "Terjadi kesalahan koneksi server."), "error");
    });
    
  } else {
    // Static Fallback Mode: In-Memory Client Session Save (Method 2)
    if (!WORKING_DATA[itemMonthStr]) {
      WORKING_DATA[itemMonthStr] = [];
    }
    
    const newIndex = WORKING_DATA[itemMonthStr].length + 1;
    newAdItem.no = newIndex;
    
    WORKING_DATA[itemMonthStr].push(newAdItem);
    
    // Reset form inputs and close modal dialog
    document.getElementById("ad-planner-form").reset();
    document.getElementById("ad-planner-modal").classList.remove("active");
    
    showToast(`Offline Mode: Iklan "${judul}" disimpan sementara di memori browser!`, "success");
    
    currentMonth = itemMonthStr;
    renderMonthTabs();
    loadMonthData();
  }
}

// Initialise App once DOM resources are completed loading
window.addEventListener("DOMContentLoaded", initApp);

// Open Account Executive Performance Modal Drawer
function openAePerformanceModal(aeName) {
  if (!aeName) return;
  
  activeAeName = aeName;
  const monthData = WORKING_DATA[currentMonth] || [];
  const aeAds = monthData.filter(item => (item.ae || "").trim() === aeName.trim());
  
  if (aeAds.length === 0) {
    showToast(`Tidak ada data iklan untuk AE ${aeName} di bulan ${currentMonth}`, "error");
    return;
  }
  
  // Set AE Name Heading
  document.getElementById("perf-ae-name").textContent = aeName;
  document.getElementById("perf-ae-period").textContent = `Periode: ${currentMonth}`;
  
  // 1. Calculate KPIs
  const totalCount = aeAds.length;
  let totalVolume = 0;
  let totalRevenue = 0;
  const inventoryCounts = {};
  
  aeAds.forEach(item => {
    const qty = parseInt(item.total_ad) || 1;
    totalVolume += qty;
    
    // Revenue calculation: prioritize custom net price (Column J)
    const rate = (item.pendapatan !== "" && !isNaN(item.pendapatan)) 
      ? parseFloat(item.pendapatan) 
      : (RATE_CARD[item.posisi] || RATE_CARD["Default"]);
    totalRevenue += qty * rate;
    
    // Inventory breakdown grouping
    inventoryCounts[item.posisi] = (inventoryCounts[item.posisi] || 0) + qty;
  });
  
  // Render KPIs
  document.getElementById("perf-total-count").textContent = totalCount;
  document.getElementById("perf-total-volume").textContent = totalVolume;
  
  // Format Currency (Indonesian Rupiah)
  const idrFormat = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  });
  document.getElementById("perf-total-revenue").textContent = idrFormat.format(totalRevenue);
  
  // 2. Render Progress Bars for Inventory Distribution
  const inventoryList = document.getElementById("perf-inventory-list");
  inventoryList.innerHTML = "";
  
  // Sort positions sold by volume descending
  const sortedInventory = Object.entries(inventoryCounts).sort((a, b) => b[1] - a[1]);
  
  sortedInventory.forEach(([posisi, qty]) => {
    const info = getPlatformInfo(posisi);
    const percentage = ((qty / totalVolume) * 100).toFixed(0);
    
    const invItem = document.createElement("div");
    invItem.className = "perf-inv-item";
    
    invItem.innerHTML = `
      <div class="perf-inv-header">
        <span>${posisi}</span>
        <span>${qty} Unit (${percentage}%)</span>
      </div>
      <div class="perf-progress-track">
        <div class="perf-progress-fill" style="width: ${percentage}%; background-color: ${info.color}; box-shadow: 0 0 8px ${info.color}80;"></div>
      </div>
    `;
    inventoryList.appendChild(invItem);
  });
  
  // 3. Render Detail Campaign Table Rows
  const campaignBody = document.getElementById("perf-campaign-body");
  campaignBody.innerHTML = "";
  
  aeAds.forEach(ad => {
    const tr = document.createElement("tr");
    
    let dateStr = ad.tgl_terbit || "";
    if (dateStr.includes('-')) {
      const pts = dateStr.split('-');
      if (pts.length === 3) {
        dateStr = `${pts[2]} / ${pts[1]}`; // Day / Month
      }
    }
    
    // Revenue check: check custom negotiated price
    const isCustomPrice = ad.pendapatan !== "" && !isNaN(ad.pendapatan);
    const rate = isCustomPrice ? parseFloat(ad.pendapatan) : (RATE_CARD[ad.posisi] || RATE_CARD["Default"]);
    const adRev = (parseInt(ad.total_ad) || 1) * rate;
    const info = getPlatformInfo(ad.posisi);
    
    // Inline price edit icon for admin mode
    const editIcon = isAdminLoggedIn 
      ? `<i class="fa-solid fa-pen-to-square" onclick="editRowPrice('${(ad.so || '').replace(/'/g, "\\'")}', '${rate}', '${ad.row_idx}')" style="margin-left: 6px; cursor: pointer; color: var(--text-muted); opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7" title="Edit Harga Net (Nego)"></i>` 
      : "";
      
    const customIndicator = isCustomPrice 
      ? `<span style="font-size: 9px; display: block; color: var(--accent-teal); font-weight: bold; margin-top: 2px;">(Harga Nego)</span>`
      : "";
    
    let modalSoContent = ad.so || '-';
    if (ad.so && ad.so !== '-') {
      if (isAdminLoggedIn) {
        modalSoContent = `<a href="https://fastkom.kompas.com/Order?search=${ad.so}" target="_blank" class="so-link-badge" style="font-size: 10px; padding: 2px 6px;" title="Buka & Salin SO ke FastKom" onclick="handleSoClick(event, '${ad.so}', '${rate}', '${ad.row_idx}')"><i class="fa-solid fa-arrow-up-right-from-square"></i> ${ad.so}</a>`;
      } else {
        modalSoContent = `<span class="so-link-badge" style="font-size: 10px; padding: 2px 6px; cursor: default; opacity: 0.7; color: var(--text-muted); background: var(--bg-tertiary);" title="Nomor SO (Login Admin untuk membuka link)"><i class="fa-solid fa-lock"></i> ${ad.so}</span>`;
      }
    }

    tr.innerHTML = `
      <td style="font-weight: 600; color: var(--text-secondary);">${dateStr}</td>
      <td style="font-weight: 700;">${ad.judul || '-'}</td>
      <td><span class="ad-badge ${info.badgeClass}">${ad.posisi || '-'}</span></td>
      <td style="text-align: center; font-weight: 700;">${ad.total_ad || 1}</td>
      <td style="font-weight: 700; color: var(--success); white-space: nowrap;">
        ${idrFormat.format(adRev)} ${editIcon}
        ${customIndicator}
      </td>
      <td class="so-cell" style="vertical-align: middle;">${modalSoContent}</td>
    `;
    campaignBody.appendChild(tr);
  });
  
  // 4. Open Modal Overlay
  document.getElementById("ae-performance-modal").classList.add("active");
}

// Bind to window to allow global inline calls from renderTable
window.openAePerformanceModal = openAePerformanceModal;

// Fetch and display visitor log modal (Admin Only)
function openVisitorLogModal() {
  if (!isAdminLoggedIn) return;
  
  fetch('/api/visitors', {
    headers: {
      'X-Admin-Password': adminPassword || ""
    }
  })
  .then(res => {
    if (!res.ok) throw new Error("Gagal mengambil data pengunjung");
    return res.json();
  })
  .then(data => {
    const tbody = document.getElementById("visitor-log-body");
    tbody.innerHTML = "";
    
    if (!data || data.length === 0) {
      tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Belum ada data pengunjung.</td></tr>";
    } else {
      // display latest first
      data.reverse().forEach((v, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${index + 1}</td>
          <td>${v.time}</td>
          <td>${v.ip}</td>
          <td style="word-break: break-all; font-size: 11px;">${v.user_agent}</td>
        `;
        tbody.appendChild(tr);
      });
    }
    document.getElementById("visitor-log-modal").classList.add("active");
  })
  .catch(err => {
    console.error(err);
    showToast("Error memuat log pengunjung", "error");
  });
}

// Trigger Google Drive Sync
function syncGoogleDrive() {
  if (!isAdminLoggedIn) return;
  
  const btn = document.getElementById("sync-gdrive-btn");
  btn.style.opacity = "0.5";
  btn.style.pointerEvents = "none";
  showToast("Memulai sinkronisasi Google Drive...", "success");
  
  fetch('/api/sync', {
    method: 'POST',
    headers: {
      'X-Admin-Password': adminPassword || ""
    }
  })
  .then(res => res.json())
  .then(data => {
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
    if (data.status === 'success') {
      showToast("Sinkronisasi berhasil! Memuat ulang data...", "success");
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      showToast(data.message || "Gagal sinkronisasi", "error");
    }
  })
  .catch(err => {
    btn.style.opacity = "1";
    btn.style.pointerEvents = "auto";
    console.error(err);
    showToast("Error sinkronisasi G-Drive", "error");
  });
}

// Update Admin Access UI states dynamically
function updateAdminUI() {
  const lockBtn = document.getElementById("admin-lock-btn");
  const lockIcon = document.getElementById("admin-lock-icon");
  const openPlannerBtn = document.getElementById("open-planner-btn");
  const openVisitorBtn = document.getElementById("open-visitor-btn");
  const syncBtn = document.getElementById("sync-gdrive-btn");
  
  if (isAdminLoggedIn) {
    lockBtn.className = "theme-btn admin-unlocked";
    lockBtn.title = "Admin Mode Aktif. Klik untuk Logout.";
    lockIcon.className = "fa-solid fa-lock-open";
    
    openPlannerBtn.style.opacity = "1";
    openPlannerBtn.style.cursor = "pointer";
    openPlannerBtn.title = "Tambah rencana iklan baru";
    openPlannerBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Tambah Outline Iklan';
    
    if (openVisitorBtn) openVisitorBtn.style.display = "inline-flex";
    if (syncBtn) syncBtn.style.display = "inline-flex";
  } else {
    lockBtn.className = "theme-btn admin-locked";
    lockBtn.title = "Login Admin untuk Mengubah Data";
    lockIcon.className = "fa-solid fa-lock";
    
    openPlannerBtn.style.opacity = "0.6";
    openPlannerBtn.style.cursor = "not-allowed";
    openPlannerBtn.title = "Harap masuk sebagai Admin terlebih dahulu";
    openPlannerBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Tambah Outline Iklan';
    
    if (openVisitorBtn) openVisitorBtn.style.display = "none";
    if (syncBtn) syncBtn.style.display = "none";
  }
  
  // Re-render components to update pointer style, tooltips, and badges
  if (currentMonth) {
    renderTable();
    renderCharts();
    if (document.getElementById("tab-omset") && document.getElementById("tab-omset").classList.contains("active")) {
      renderMedsosGallery();
    }
  }
}

// Handle Admin password submissions
function handleAdminLogin(e) {
  e.preventDefault();
  const password = document.getElementById("login-password").value;
  const errorAlert = document.getElementById("login-error-alert");
  
  if (!password) return;
  
  if (isServerEnv) {
    // Server Mode: Verify password with backend
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password })
    })
    .then(res => {
      if (!res.ok) {
        throw new Error("wrong password");
      }
      return res.json();
    })
    .then(data => {
      // Successfully authenticated
      isAdminLoggedIn = true;
      adminPassword = password;
      
      sessionStorage.setItem("isAdminLoggedIn", "true");
      sessionStorage.setItem("adminPassword", password);
      
      // Update displays
      updateAdminUI();
      
      // Close modal
      document.getElementById("admin-login-modal").classList.remove("active");
      document.getElementById("login-password").value = "";
      errorAlert.style.display = "none";
      
      showToast("Autentikasi Admin Berhasil!", "success");
    })
    .catch(err => {
      console.error(err);
      errorAlert.style.display = "block";
      errorAlert.textContent = getCleanErrorMessage(err, "wrong password");
      showToast("Login gagal!", "error");
    });
  } else {
    // Offline Static Fallback Mode check
    if (password === "admin123") {
      isAdminLoggedIn = true;
      adminPassword = password;
      
      sessionStorage.setItem("isAdminLoggedIn", "true");
      sessionStorage.setItem("adminPassword", password);
      
      updateAdminUI();
      
      document.getElementById("admin-login-modal").classList.remove("active");
      document.getElementById("login-password").value = "";
      errorAlert.style.display = "none";
      
      showToast("Offline Admin Unlocked!", "success");
    } else {
      errorAlert.style.display = "block";
      errorAlert.textContent = "wrong password";
      showToast("Login gagal!", "error");
    }
  }
}

// Edit specific ad price inline (Admin authorization required)
function editRowPrice(so, currentPrice, rowIdx) {
  if (!isAdminLoggedIn) {
    showToast("Harap login sebagai Admin untuk mengubah harga!", "error");
    return;
  }
  
  const currentPriceFormatted = parseFloat(currentPrice) ? parseFloat(currentPrice).toLocaleString('id-ID') : currentPrice;
  const promptLabel = so ? `untuk SO #${so}` : `untuk Baris #${rowIdx}`;
  const newPriceStr = prompt(`Masukkan Harga Net / Nego Baru ${promptLabel} (Tarif Saat Ini: Rp ${currentPriceFormatted}):\n(Kosongkan kolom input untuk mereset harga kembali ke Tarif Resmi Rate Card)`, currentPrice);
  
  if (newPriceStr === null) return; // Prompt cancelled
  
  let priceToSend = newPriceStr.trim();
  if (priceToSend !== "") {
    // Strip all non-digit characters (like dots, commas, spaces, letters, "Rp")
    priceToSend = priceToSend.replace(/\D/g, "");
  }
  
  if (isServerEnv) {
    showToast("Menyimpan harga nego ke Excel...", "success");
    
    fetch('/api/edit-price', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': adminPassword
      },
      body: JSON.stringify({
        so: so,
        price: priceToSend,
        sheet_name: currentMonth,
        row_idx: rowIdx
      })
    })
    .then(res => {
      if (res.status === 401) {
        throw new Error("Akses Ditolak! Sesi Admin kedaluwarsa.");
      }
      if (!res.ok) {
        return res.text().then(text => {
          let errMsg = "Gagal mengubah harga di Excel.";
          try {
            const errData = JSON.parse(text);
            errMsg = errData.message || errMsg;
          } catch(e) {
            errMsg = text || errMsg;
          }
          throw new Error(errMsg);
        });
      }
      return res.json();
    })
    .then(resData => {
      showToast(resData.message || "Harga net berhasil disimpan ke Excel!", "success");
      
      // Dynamic reload dataset from server to sync state
      return fetch('/api/data?t=' + Date.now())
        .then(res => {
          if (!res.ok) {
            return res.text().then(text => { throw new Error(text || `HTTP Error ${res.status}`); });
          }
          return res.json();
        })
        .then(data => {
          WORKING_DATA = data;
          renderTable();
          renderCalendar();
          // Reload active modal to recalculate with new pricing
          openAePerformanceModal(activeAeName);
        });
    })
    .catch(err => {
      console.error(err);
      showToast(getCleanErrorMessage(err, "Gagal mengubah harga di server."), "error");
    });
    
  } else {
    // Static Fallback Mode edit (In-Memory Session)
    const monthData = WORKING_DATA[currentMonth] || [];
    const targetAd = monthData.find(item => item.so === so);
    
    if (targetAd) {
      targetAd.pendapatan = priceToSend === "" ? "" : parseInt(priceToSend, 10);
      showToast("Offline Mode: Harga diperbarui di memori browser!", "success");
      renderTable();
      openAePerformanceModal(activeAeName);
    } else {
      showToast("Iklan dengan SO tersebut tidak ditemukan!", "error");
    }
  }
}

// Bind to window to allow global inline calls from rendered HTML
window.editRowPrice = editRowPrice;

// Function to dynamically compile and download a memo outline receipt
function downloadMemo(event, memoNo, judul, so, posisi, total, tgl, ae) {
  if (event) {
    event.stopPropagation();
  }
  
  if (!memoNo || memoNo === '-') {
    showToast("Memo tidak tersedia untuk iklan ini!", "error");
    return;
  }
  
  // Extract URL if user pasted a Google Drive link (or any link) in the Keterangan Order
  const urlMatch = memoNo.match(/https?:\/\/[^\s]+/);
  if (urlMatch) {
    let targetUrl = urlMatch[0];
    
    // Check if it is a Google Drive link to convert to a direct download link
    if (targetUrl.includes("drive.google.com")) {
      let fileId = "";
      const fileIdMatch = targetUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const openIdMatch = targetUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      
      if (fileIdMatch) {
        fileId = fileIdMatch[1];
      } else if (openIdMatch) {
        fileId = openIdMatch[1];
      }
      
      if (fileId) {
        targetUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        showToast("Mengunduh berkas memo asli dari Google Drive...", "success");
      } else {
        showToast("Membuka dokumen Google Drive...", "success");
      }
    } else {
      showToast("Membuka tautan dokumen...", "success");
    }
    
    window.open(targetUrl, '_blank');
    return;
  }
  
  if (isServerEnv) {
    // Server-connected environment: stream actual PDF/Word/Excel file directly
    showToast("Mengunduh berkas memo asli dari server...", "success");
    const downloadUrl = `/api/download-memo?memo=${encodeURIComponent(memoNo)}&so=${encodeURIComponent(so || '')}`;
    
    const link = document.createElement("a");
    link.href = downloadUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }
  
  // Offline mode handling using MEMO_MAP
  let fullFileName = null;
  if (typeof MEMO_MAP !== 'undefined' && memoNo) {
    const prefixMatch = memoNo.match(/(\d+)/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      if (MEMO_MAP[prefix]) fullFileName = MEMO_MAP[prefix];
      else if (MEMO_MAP[parseInt(prefix, 10)]) fullFileName = MEMO_MAP[parseInt(prefix, 10)];
    }
  }

  if (fullFileName) {
    // Offline mode: open memo PDF from relative path
    showToast("Membuka berkas memo PDF dari folder lokal...", "success");
    
    // For file:// protocol (visitor opening directly from folder), 
    // construct an absolute file URL based on current page location
    let memoUrl;
    if (window.location.protocol === 'file:') {
      // Get the directory of the current page and navigate to memo folder
      const baseDir = window.location.href.substring(0, window.location.href.lastIndexOf('/'));
      memoUrl = baseDir + '/memo/' + encodeURIComponent(fullFileName);
    } else {
      memoUrl = 'memo/' + encodeURIComponent(fullFileName);
    }
    
    console.log('[MemoDownload] Opening:', memoUrl);
    
    // Open in new tab first (works in file:// mode)
    const win = window.open(memoUrl, '_blank');
    if (!win) {
      // Fallback if popup blocked: use direct link
      const link = document.createElement("a");
      link.href = memoUrl;
      link.download = fullFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } else {
    // Local static fallback mode: generate beautiful text-based receipt block
    const formattedDate = new Date().toLocaleString('id-ID', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    
    const memoContent = `===========================================================
               MEMO OUTLINE IKLAN MEDIA SOSIAL
                        HARIAN KOMPAS
===========================================================

Nomor Memo      : ${memoNo}
Sales Order (SO): ${so || '-'}
Judul Kampanye  : ${judul || '-'}
Saluran Media   : ${posisi || '-'}
Total Tayang    : ${total || 1} Unit
Tanggal Terbit  : ${tgl || '-'}
Account Exec/CP : ${ae || '-'}

-----------------------------------------------------------
Tanda terima ini diunduh otomatis dalam mode statis offline.
Dicetak pada    : ${formattedDate}
===========================================================`;

    const blob = new Blob([memoContent], { type: "text/plain;charset=utf-8" });
    const filename = `Tanda_Terima_Memo_${(so || memoNo).replace(/\s+/g, '_')}.txt`;
    
    if (window.navigator && window.navigator.msSaveOrOpenBlob) {
      window.navigator.msSaveOrOpenBlob(blob, filename);
    } else {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    showToast("Berkas tanda terima memo berhasil diunduh!", "success");
  }
}


// Bind to window to allow global inline calls from rendered HTML
window.downloadMemo = downloadMemo;

let pendingSoPriceUpdate = null;

// Helper: Copy SO number to clipboard and show premium toast notification
function handleSoClick(event, soNumber, currentPrice, rowIdx) {
  if (!soNumber || soNumber === '-') return;
  
  navigator.clipboard.writeText(soNumber).then(() => {
    showToast(`Nomor SO <strong>${soNumber}</strong> berhasil disalin! Silakan tempel (Ctrl+V) di kolom pencarian FastKom.`, "success");
    
    // Set pending state to trigger prompt when user returns, but ONLY if they are an admin
    if (rowIdx && isAdminLoggedIn) {
      pendingSoPriceUpdate = { so: soNumber, price: currentPrice, rowIdx: rowIdx };
    }
  }).catch(err => {
    console.error("Gagal menyalin nomor SO ke clipboard", err);
  });
}
window.handleSoClick = handleSoClick;

// Automatically prompt user for new net price when returning from FastKom
window.addEventListener('focus', () => {
  if (pendingSoPriceUpdate) {
    const { so, price, rowIdx } = pendingSoPriceUpdate;
    pendingSoPriceUpdate = null; // Clear it immediately
    
    // Delay prompt slightly to ensure rendering and avoid blocking
    setTimeout(() => {
      if (typeof editRowPrice === 'function') {
        editRowPrice(so, price, rowIdx);
      }
    }, 500);
  }
});

// Edit specific ad SO number inline (Admin authorization required)
function editRowSO(currentSO, rowIdx) {
  if (!isAdminLoggedIn) {
    showToast("Harap login sebagai Admin untuk mengubah Nomor SO!", "error");
    return;
  }
  
  const newSOStr = prompt(`Masukkan Nomor SO (Sales Order) Baru untuk Baris #${rowIdx} (Nomor Saat Ini: ${currentSO || '-'}):\n(Nomor SO ini harus sesuai dengan yang terdaftar di FastKom)`, currentSO);
  
  if (newSOStr === null) return; // Prompt cancelled
  
  const soToSend = newSOStr.trim();
  if (soToSend === "") {
    showToast("Nomor SO tidak boleh kosong!", "error");
    return;
  }
  
  if (isServerEnv) {
    showToast("Menyimpan nomor SO baru ke Excel...", "success");
    
    fetch('/api/edit-so', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': adminPassword
      },
      body: JSON.stringify({
        so: soToSend,
        sheet_name: currentMonth,
        row_idx: rowIdx
      })
    })
    .then(res => {
      if (res.status === 401) {
        throw new Error("Akses Ditolak! Sesi Admin kedaluwarsa.");
      }
      if (!res.ok) {
        return res.text().then(text => {
          let errMsg = "Gagal mengubah nomor SO di Excel.";
          try {
            const errData = JSON.parse(text);
            errMsg = errData.message || errMsg;
          } catch(e) {
            errMsg = text || errMsg;
          }
          throw new Error(errMsg);
        });
      }
      return res.json();
    })
    .then(resData => {
      showToast(resData.message || "Nomor SO berhasil disimpan ke Excel!", "success");
      
      // Dynamic reload dataset from server to sync state
      return fetch('/api/data?t=' + Date.now())
        .then(res => {
          if (!res.ok) {
            return res.text().then(text => { throw new Error(text || `HTTP Error ${res.status}`); });
          }
          return res.json();
        })
        .then(data => {
          WORKING_DATA = data;
          renderTable();
          renderCalendar();
          // Reset selected day details if open
          if (selectedDayNum !== null) {
            const monthData = WORKING_DATA[currentMonth] || [];
            const adsByDay = {};
            monthData.forEach(item => {
              const day = getDayFromDate(item.tgl_terbit);
              if (day) {
                if (!adsByDay[day]) adsByDay[day] = [];
                adsByDay[day].push(item);
              }
            });
            renderDayDetailDrawer(selectedDayNum, adsByDay[selectedDayNum] || []);
          }
        });
    })
    .catch(err => {
      console.error(err);
      showToast(getCleanErrorMessage(err, "Gagal mengubah nomor SO di server."), "error");
    });
    
  } else {
    // Static Fallback Mode edit (In-Memory Session)
    const monthData = WORKING_DATA[currentMonth] || [];
    const targetAd = monthData.find(item => item.row_idx == rowIdx);
    
    if (targetAd) {
      targetAd.so = soToSend;
      showToast("Offline Mode: Nomor SO diperbarui di memori browser!", "success");
      renderTable();
      renderCalendar();
      if (selectedDayNum !== null) {
        const adsByDay = {};
        monthData.forEach(item => {
          const day = getDayFromDate(item.tgl_terbit);
          if (day) {
            if (!adsByDay[day]) adsByDay[day] = [];
            adsByDay[day].push(item);
          }
        });
        renderDayDetailDrawer(selectedDayNum, adsByDay[selectedDayNum] || []);
      }
    } else {
      showToast("Iklan pada baris tersebut tidak ditemukan!", "error");
    }
  }
}
window.editRowSO = editRowSO;

// --- Visitor Guide Onboarding Tour Controller ---
let currentGuideSlideIndex = 0;

const GUIDE_SLIDES = [
  {
    title: "Selamat Datang di Dashboard Outline!",
    icon: "fa-solid fa-handshake",
    iconColor: "var(--primary-light)",
    content: `
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 12px; color: var(--text-primary);">
        Halo! Selamat datang di <strong>Dashboard Outline Iklan Media Sosial Harian Kompas & Kompas.id</strong>.
      </p>
      <p style="font-size: 13.5px; line-height: 1.6; color: var(--text-secondary); margin-bottom: 16px;">
        Dashboard ini dirancang secara khusus untuk memantau jadwal penayangan iklan, menganalisis kontribusi Account Executive (AE), dan mengelola data outline media sosial secara dinamis dan transparan.
      </p>
      <div style="background: var(--primary-glow); border-left: 4px solid var(--primary-light); padding: 12px; border-radius: 8px; font-size: 12.5px; line-height: 1.5; color: var(--text-primary);">
        <i class="fa-solid fa-circle-info" style="color: var(--primary-light); margin-right: 6px;"></i>
        <strong>Informasi Cepat:</strong> Anda berada dalam <strong>Mode Tamu (Guest Mode)</strong> secara default. Anda memiliki akses penuh untuk menjelajah, memfilter data, melihat grafik kinerja, dan mengunduh laporan omset AE.
      </div>
    `
  },
  {
    title: "Kalender Interaktif & Detail Iklan",
    icon: "fa-solid fa-calendar-days",
    iconColor: "var(--accent-gold)",
    content: `
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 12px; color: var(--text-primary);">
        Pantau jadwal publikasi iklan harian secara terstruktur menggunakan <strong>Kalender Perencanaan</strong>:
      </p>
      <ul style="font-size: 13px; line-height: 1.6; color: var(--text-secondary); padding-left: 20px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px;">
        <li>Setiap tanggal yang memiliki jadwal iklan akan menampilkan <strong>jumlah iklan</strong> di pojok kanan atas sel kalender.</li>
        <li><strong>Titik Warna (Dots)</strong> mewakili jenis platform penayangan (Kuning = IG Story, Toska = IG Post, Merah = Youtube, Pink = IG Reels, dll).</li>
        <li><strong>KLIK TANGGAL:</strong> Klik pada tanggal tertentu di kalender untuk menampilkan <strong>Detail Outline Iklan</strong> secara instan di panel drawer sebelah kanan!</li>
      </ul>
      <div style="background: var(--accent-gold-glow); border-left: 4px solid var(--accent-gold); padding: 12px; border-radius: 8px; font-size: 12.5px; line-height: 1.5; color: var(--text-primary);">
        <i class="fa-solid fa-lightbulb" style="color: var(--accent-gold); margin-right: 6px;"></i>
        <strong>Tips Cepat:</strong> Klik tanggal yang sama untuk kedua kalinya jika Anda ingin menutup pilihan tanggal dan melihat keseluruhan data bulan berjalan kembali.
      </div>
    `
  },
  {
    title: "Hub Analisis & Galeri Bukti Tayang",
    icon: "fa-solid fa-chart-pie",
    iconColor: "var(--accent-teal)",
    content: `
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 12px; color: var(--text-primary);">
        Eksplorasi visualisasi data dan bukti penayangan iklan melalui <strong>Hub Analisis</strong>:
      </p>
      <ul style="font-size: 13px; line-height: 1.6; color: var(--text-secondary); padding-left: 20px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px;">
        <li><strong>Distribusi Saluran:</strong> Diagram lingkaran interaktif yang menggambarkan proporsi persentase penempatan iklan di setiap platform sosial media.</li>
        <li><strong>Bukti Tayang Iklan (Galeri):</strong> Klik tab <em>"Bukti Tayang Iklan"</em> untuk membuka <strong>Spotlight Viewer</strong>. Di sini Anda bisa memutar langsung preview video iklan (Youtube, Reels) atau melihat gambar materi yang telah terbit!</li>
        <li><strong>Kinerja AE:</strong> Grafik batang beban kerja AE. <strong>Klik pada grafik AE</strong> untuk membuka modal analisis mendalam (menampilkan unit iklan, estimasi omset penjualan, dan log order detail dari AE tersebut).</li>
      </ul>
    `
  },
  {
    title: "Pencarian Pintar & Unduh Laporan",
    icon: "fa-solid fa-magnifying-glass",
    iconColor: "var(--primary-light)",
    content: `
      <p style="font-size: 14px; line-height: 1.6; margin-bottom: 12px; color: var(--text-primary);">
        Temukan informasi spesifik dengan cepat menggunakan fitur pencarian dan tabel pintar:
      </p>
      <ul style="font-size: 13px; line-height: 1.6; color: var(--text-secondary); padding-left: 20px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px;">
        <li><strong>Tabel Data Outline Tersembunyi:</strong> Demi kebersihan UI, tabel data iklan tidak langsung ditampilkan. <strong>Ketikkan kata kunci</strong> (seperti Nama Brand, Nomor Sales Order (SO), atau AE) atau pilih filter <strong>Platform/AE</strong> untuk memunculkan tabel data!</li>
        <li><strong>Rentang Periode Omset:</strong> Gunakan dropdown rentang periode di sebelah kanan atas tabel untuk menyaring data omset gabungan dari beberapa bulan.</li>
        <li><strong>Download Omset AE:</strong> Klik tombol <em>"Download Omset AE"</em> untuk mengekspor data omset terfilter dalam format berkas CSV secara instan.</li>
      </ul>
      <div style="background: var(--success-glow); border-left: 4px solid var(--success); padding: 12px; border-radius: 8px; font-size: 12.5px; line-height: 1.5; color: var(--text-primary);">
        <i class="fa-solid fa-circle-check" style="color: var(--success); margin-right: 6px;"></i>
        Panduan selesai! Sekarang Anda siap menjelajahi dashboard outline iklan media sosial secara optimal.
      </div>
    `
  }
];

function openGuideModal() {
  currentGuideSlideIndex = 0;
  renderGuideSlide();
  document.getElementById("visitor-guide-modal").classList.add("active");
}
window.openGuideModal = openGuideModal;

function closeGuideModal() {
  document.getElementById("visitor-guide-modal").classList.remove("active");
  // Set localStorage mark so it doesn't open automatically next time
  localStorage.setItem("guide_seen", "true");
}
window.closeGuideModal = closeGuideModal;

function renderGuideSlide() {
  const container = document.getElementById("guide-slides-container");
  const dotsContainer = document.getElementById("guide-dots");
  const prevBtn = document.getElementById("guide-prev-btn");
  const nextBtn = document.getElementById("guide-next-btn");
  
  if (!container || !dotsContainer) return;
  
  const slide = GUIDE_SLIDES[currentGuideSlideIndex];
  
  // Render content
  container.innerHTML = `
    <div class="guide-slide">
      <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 8px;">
        <div class="guide-icon-wrapper" style="color: ${slide.iconColor};">
          <i class="${slide.icon}"></i>
        </div>
        <div>
          <h4 class="guide-slide-title" style="margin: 0; font-size: 18px; font-weight: 800;">${slide.title}</h4>
          <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; letter-spacing: 1px;">
            Langkah ${currentGuideSlideIndex + 1} dari ${GUIDE_SLIDES.length}
          </span>
        </div>
      </div>
      <div class="guide-slide-description" style="margin-top: 8px;">
        ${slide.content}
      </div>
    </div>
  `;
  
  // Render dots
  dotsContainer.innerHTML = "";
  GUIDE_SLIDES.forEach((_, idx) => {
    const dot = document.createElement("div");
    dot.className = `guide-dot ${idx === currentGuideSlideIndex ? "active" : ""}`;
    dot.onclick = () => goToGuideSlide(idx);
    dot.title = `Langkah ${idx + 1}`;
    dotsContainer.appendChild(dot);
  });
  
  // Update Buttons state
  if (currentGuideSlideIndex === 0) {
    prevBtn.style.visibility = "hidden";
  } else {
    prevBtn.style.visibility = "visible";
  }
  
  if (currentGuideSlideIndex === GUIDE_SLIDES.length - 1) {
    nextBtn.innerHTML = 'Mulai Jelajah <i class="fa-solid fa-rocket" style="margin-left: 4px;"></i>';
    nextBtn.style.background = "linear-gradient(135deg, var(--success), #059669)";
    nextBtn.style.boxShadow = "0 4px 15px rgba(16, 185, 129, 0.25)";
  } else {
    nextBtn.innerHTML = 'Lanjut <i class="fa-solid fa-chevron-right" style="margin-left: 4px;"></i>';
    nextBtn.style.background = "linear-gradient(135deg, var(--primary), #1d4ed8)";
    nextBtn.style.boxShadow = "0 4px 15px rgba(0, 79, 159, 0.25)";
  }
}

function nextGuideSlide() {
  if (currentGuideSlideIndex === GUIDE_SLIDES.length - 1) {
    closeGuideModal();
    showToast("Selamat mengeksplorasi Dashboard Outline Iklan Medsos!", "success");
  } else {
    currentGuideSlideIndex++;
    renderGuideSlide();
  }
}
window.nextGuideSlide = nextGuideSlide;

function prevGuideSlide() {
  if (currentGuideSlideIndex > 0) {
    currentGuideSlideIndex--;
    renderGuideSlide();
  }
}
window.prevGuideSlide = prevGuideSlide;

function goToGuideSlide(index) {
  if (index >= 0 && index < GUIDE_SLIDES.length) {
    currentGuideSlideIndex = index;
    renderGuideSlide();
  }
}
window.goToGuideSlide = goToGuideSlide;


