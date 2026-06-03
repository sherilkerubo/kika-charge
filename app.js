// Kika-Charge Application Logic & State Simulation

// 1. DATABASE OF DECENTRALIZED KIOSKS (Offline Cached database)
// Mock coordinates & reference locations in Nairobi.
const kiosksDatabase = [
    {
        id: "kio_mama_cynthia",
        name: "Mama Cynthia's Solar Kiosk",
        locationId: "nairobi_west",
        distance: 120, // meters
        landmark: "📍 Nairobi West, next to Airtel pole",
        batteriesAvailable: 4,
        chargingPortsOpen: 2,
        solarActive: true,
        solarCapacityKW: 5.5,
        rating: "Verified Partner ⭐",
        basePrice: 150
    },
    {
        id: "kio_kamau_shop",
        name: "Kamau Electronics & Solar Swap",
        locationId: "nairobi_west",
        distance: 310,
        landmark: "📍 Behind Shell Petrol Station",
        batteriesAvailable: 2,
        chargingPortsOpen: 4,
        solarActive: true,
        solarCapacityKW: 8.0,
        rating: "Verified Partner ⭐",
        basePrice: 140
    },
    {
        id: "kio_matatu_hub",
        name: "Langata Matatu Stage Power Kiosk",
        locationId: "nairobi_west",
        distance: 490,
        landmark: "📍 Next to boda-boda stage entrance",
        batteriesAvailable: 5,
        chargingPortsOpen: 1,
        solarActive: false, // On grid mode
        solarCapacityKW: 0,
        rating: "Standard Kiosk ⚡",
        basePrice: 160
    },
    {
        id: "kio_cbd_express",
        name: "CBD Boda Swap & Go",
        locationId: "cbd",
        distance: 90,
        landmark: "📍 Ronald Ngala St, opposite Naivas",
        batteriesAvailable: 6,
        chargingPortsOpen: 0,
        solarActive: false,
        solarCapacityKW: 0,
        rating: "Express Station ⚡",
        basePrice: 170
    },
    {
        id: "kio_solar_karen_01",
        name: "Karen Green Charging",
        locationId: "karen",
        distance: 250,
        landmark: "📍 Karen Shopping Center, back alley",
        batteriesAvailable: 5,
        chargingPortsOpen: 3,
        solarActive: true,
        solarCapacityKW: 12.0,
        rating: "Premium Solar Hub ⭐",
        basePrice: 130
    },
    {
        id: "kio_mama_lucy",
        name: "Lucy's Market Stand Charging",
        locationId: "kilimani",
        distance: 180,
        landmark: "📍 Kilimani Organic Market, Stall 14",
        batteriesAvailable: 3,
        chargingPortsOpen: 3,
        solarActive: true,
        solarCapacityKW: 4.5,
        rating: "Verified Partner ⭐",
        basePrice: 150
    }
];

// 2. APP STATE GLOBAL VARIABLE
const state = {
    currentRole: "driver", // driver | host
    selectedLocationId: "nairobi_west",
    solarIntensity: 85, // 0 to 100
    
    driver: {
        id: "drv_204",
        name: "Rider #204 - Kamau",
        wallet: 420.00,
        battery: 14,
        range: 9, // km
        currentSelectedKiosk: null
    },

    host: {
        id: "kio_mama_cynthia",
        name: "Mama Cynthia's Solar Kiosk",
        landmark: "📍 Nairobi West, next to Airtel pole",
        online: true,
        solarKW: 4.2,
        basePrice: 150,
        earningsToday: 1320.00,
        momoBalance: 3840.00,
        // Represents physical state of charging bays
        rackSlots: [
            { id: 1, pct: 100, status: "ready" },      // Ready for driver swap
            { id: 2, pct: 78, status: "charging" },   // Currently solar charging
            { id: 3, pct: 0, status: "empty" },        // Swapped out / vacant slot
            { id: 4, pct: 100, status: "ready" },      // Ready for driver swap
            { id: 5, pct: 42, status: "charging" },   // Solar charging
            { id: 6, pct: 12, status: "low" }          // Grid backup charging
        ]
    },

    activeSwap: null
};

// 3. TELEMETRY LOGGING UTILITIES
function logConsole(message, type = "system") {
    const consoleOutput = document.getElementById("console-output");
    if (!consoleOutput) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logDiv = document.createElement("div");
    logDiv.className = `log-entry ${type}-log`;
    logDiv.textContent = `[${time}] ${message}`;
    
    consoleOutput.appendChild(logDiv);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function updateTelemetrySize(packetText) {
    const sizeBytes = new Blob([packetText]).size;
    const sizeKB = (sizeBytes / 1024).toFixed(3);
    
    const sizeEl = document.getElementById("telemetry-size");
    const barEl = document.getElementById("telemetry-bar");
    const savedEl = document.getElementById("data-saved-pct");

    if (sizeEl) sizeEl.textContent = `${sizeKB} KB (${sizeBytes} bytes)`;
    
    // Max SMS/UDP budget is 2 KB (2048 bytes)
    const pct = Math.min((sizeBytes / 2048) * 100, 100);
    if (barEl) {
        barEl.style.width = `${pct}%`;
        // Color scale
        if (pct < 10) barEl.style.backgroundColor = "var(--energy-green)";
        else if (pct < 50) barEl.style.backgroundColor = "var(--solar-yellow)";
        else barEl.style.backgroundColor = "var(--danger)";
    }

    // Compare with average Map API size (~3.2 MB)
    const savedPct = (100 - (sizeBytes / (3.2 * 1024 * 1024)) * 100).toFixed(2);
    if (savedEl) savedEl.textContent = `Saved: ${savedPct}%`;
}

// Compact text serializer (delimiter-based, simulating low-bandwidth UDP/SMS protocols)
function serializePacket(action, params) {
    let packet = `KIKA:${action}`;
    for (const [key, value] of Object.entries(params)) {
        packet += `|${key}:${value}`;
    }
    return packet;
}

// 4. COMPUTATIONS
function getDynamicPrice(kiosk) {
    if (!kiosk.solarActive) return kiosk.basePrice;
    
    // Price scales down as solar intensity goes up (surplus supply)
    // At 100% solar intensity, discount is 30%
    const discountFactor = (state.solarIntensity / 100) * 0.30;
    const finalPrice = Math.round(kiosk.basePrice * (1 - discountFactor));
    return finalPrice;
}

// 5. DRIVER VIEW RENDER
function renderKiosks() {
    const listContainer = document.getElementById("kiosk-list");
    if (!listContainer) return;

    listContainer.innerHTML = "";
    
    // Filter kiosks by currently selected simulated location
    const localKiosks = kiosksDatabase.filter(k => k.locationId === state.selectedLocationId);

    // Sync Mama Cynthia's online status with Host panel
    const mamaC = localKiosks.find(k => k.id === "kio_mama_cynthia");
    if (mamaC) {
        mamaC.online = state.host.online;
    }

    // Sort by distance
    localKiosks.sort((a, b) => a.distance - b.distance);

    localKiosks.forEach(k => {
        // Skip rendering if offline (unless it's standard grid kiosk always on)
        if (k.id === "kio_mama_cynthia" && !state.host.online) {
            return;
        }

        const price = getDynamicPrice(k);
        const isSolarActive = k.solarActive && state.solarIntensity > 30;

        const card = document.createElement("div");
        card.className = "kiosk-card";
        card.onclick = () => selectKioskForSwap(k);

        card.innerHTML = `
            <div class="kiosk-card-header">
                <div class="kiosk-title-box">
                    <h4>${k.name} <span class="verified-icon">✓</span></h4>
                    <span class="landmark-text">${k.landmark}</span>
                </div>
                <span class="distance-badge">${k.distance}m</span>
            </div>
            <div class="kiosk-card-body">
                <div class="stat-item">
                    <span class="stat-label">Full Batteries</span>
                    <span class="stat-value text-green">${k.id === "kio_mama_cynthia" ? countReadyHostBatteries() : k.batteriesAvailable} Ready</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Charging Slots</span>
                    <span class="stat-value">${k.chargingPortsOpen} Open</span>
                </div>
                <div class="stat-item text-right">
                    ${isSolarActive ? `<span class="solar-pill">☀️ Solar Peak</span>` : `<span class="solar-pill" style="background:rgba(255,255,255,0.05); color:var(--text-muted); border:1px solid var(--border-color)">🔌 Grid Mode</span>`}
                    <span class="swap-price">KES ${price}</span>
                </div>
            </div>
            <button class="btn btn-accent btn-block" style="margin-top: 4px;">⚡ Swap Battery Here</button>
        `;
        listContainer.appendChild(card);
    });
}

function countReadyHostBatteries() {
    return state.host.rackSlots.filter(s => s.status === "ready").length;
}

// 6. HOST VIEW RENDER
function renderRack() {
    const rackContainer = document.getElementById("battery-rack-grid");
    if (!rackContainer) return;

    rackContainer.innerHTML = "";

    state.host.rackSlots.forEach(slot => {
        const slotDiv = document.createElement("div");
        slotDiv.className = `rack-slot slot-state-${slot.status}`;
        slotDiv.onclick = () => toggleSlotState(slot.id);

        let statusText = "Vacant";
        if (slot.status === "ready") statusText = "Ready";
        else if (slot.status === "charging") statusText = "Charging";
        else if (slot.status === "low") statusText = "Low Cell";

        slotDiv.innerHTML = `
            <span class="slot-num">BAY 0${slot.id}</span>
            <div class="slot-battery">
                <div class="slot-battery-fill" style="width: ${slot.pct}%;"></div>
            </div>
            <span class="slot-pct">${slot.pct}%</span>
            <span class="slot-status-lbl">${statusText}</span>
        `;
        rackContainer.appendChild(slotDiv);
    });

    // Update solar generation and price tags based on solar intensity
    const solarKWVal = ((state.solarIntensity / 100) * 5.0).toFixed(1);
    state.host.solarKW = parseFloat(solarKWVal);
    
    document.getElementById("host-solar-kw").textContent = `${state.host.solarKW} kW`;
    
    const calculatedPrice = getDynamicPrice(state.host);
    document.getElementById("host-current-price").textContent = `KES ${calculatedPrice}`;
}

function toggleSlotState(slotId) {
    const slot = state.host.rackSlots.find(s => s.id === slotId);
    if (!slot) return;

    // Toggle logic: ready -> charging -> low -> empty -> ready
    if (slot.status === "ready") {
        slot.status = "charging";
        slot.pct = 45;
    } else if (slot.status === "charging") {
        slot.status = "low";
        slot.pct = 12;
    } else if (slot.status === "low") {
        slot.status = "empty";
        slot.pct = 0;
    } else {
        slot.status = "ready";
        slot.pct = 100;
    }
    
    renderRack();
    renderKiosks();
    
    logConsole(`[HOST] Manually toggled Bay 0${slotId} state to ${slot.status.toUpperCase()} (${slot.pct}%)`, "system");
}

// 7. INTERACTIVE FLOW HANDLERS

// Select a kiosk as a driver
function selectKioskForSwap(kiosk) {
    state.driver.currentSelectedKiosk = kiosk;
    const price = getDynamicPrice(kiosk);
    
    // Simulate telemetry ping broadcast: check latest real-time status of this kiosk
    const pingParams = {
        DRV: state.driver.id,
        LOC: state.selectedLocationId,
        CHK_KIO: kiosk.id
    };
    const packet = serializePacket("QUERY_STATION", pingParams);
    
    logConsole(`[TX] Broadcasting status request: ${packet}`, "tx");
    updateTelemetrySize(packet);

    // Simulate response delay (~300ms)
    setTimeout(() => {
        const respParams = {
            KIO: kiosk.id,
            STAT: state.host.online ? "ONLINE" : "OFFLINE",
            BATT_QTY: kiosk.id === "kio_mama_cynthia" ? countReadyHostBatteries() : kiosk.batteriesAvailable,
            PRICE: price
        };
        const respPacket = serializePacket("STATUS_RESP", respParams);
        logConsole(`[RX] Received data packet: ${respPacket}`, "rx");
        updateTelemetrySize(respPacket);
        
        // Show Mobile Money popup
        showMomoModal(kiosk, price);
    }, 400);
}

// Show MoMo Checkout Modal
function showMomoModal(kiosk, price) {
    const modal = document.getElementById("momo-modal");
    const amountEl = document.getElementById("momo-charge-amount");
    const descEl = document.getElementById("momo-charge-description");
    
    amountEl.textContent = `KES ${price}.00`;
    descEl.textContent = `Battery Swap Code #${Math.floor(Math.random() * 9000) + 1000} at ${kiosk.name}`;
    
    modal.classList.remove("hidden");
    document.getElementById("momo-pin").value = "";
    document.getElementById("momo-pin").focus();
}

// Hide MoMo Checkout Modal
function hideMomoModal() {
    document.getElementById("momo-modal").classList.add("hidden");
}

// Handle MoMo Authorization Confirm
function handleMomoSubmit() {
    const pinVal = document.getElementById("momo-pin").value;
    if (pinVal.length < 4) {
        alert("Please enter a valid 4-digit PIN.");
        return;
    }

    hideMomoModal();

    const kiosk = state.driver.currentSelectedKiosk;
    const price = getDynamicPrice(kiosk);

    // Setup active swap transaction state
    state.activeSwap = {
        kiosk: kiosk,
        price: price,
        step: 1
    };

    // Serialize payment request telemetry packet
    const payParams = {
        DRV: state.driver.id,
        KIO: kiosk.id,
        AMT: price,
        MOMO_REF: "TXN_" + Math.random().toString(36).substr(2, 9).toUpperCase()
    };
    const packet = serializePacket("MOMO_PAY_REQ", payParams);
    
    logConsole(`[TX] Mobile Money Authorization sent: ${packet}`, "tx");
    updateTelemetrySize(packet);

    // Open Progress screen
    const progressModal = document.getElementById("swap-progress-modal");
    progressModal.classList.remove("hidden");
    
    document.getElementById("swap-progress-kiosk").textContent = kiosk.name;
    document.getElementById("swap-phase-lbl").textContent = "Awaiting Kiosk Approval...";
    
    const stepPayment = document.getElementById("step-payment");
    const stepApproval = document.getElementById("step-approval");
    const stepSwap = document.getElementById("step-swap");

    stepPayment.className = "swap-step active";
    stepApproval.className = "swap-step";
    stepSwap.className = "swap-step";

    // Dynamic Step Simulation
    setTimeout(() => {
        // Step 2: Kiosk approves swap
        state.activeSwap.step = 2;
        stepApproval.className = "swap-step active";
        document.getElementById("swap-phase-lbl").textContent = "Unlocking battery slot...";
        
        // Show simulation shortcut for kiosk approval if Mama Cynthia (the simulated host) is selected
        const simHostBtn = document.getElementById("swap-host-sim-actions");
        if (kiosk.id === "kio_mama_cynthia") {
            simHostBtn.classList.remove("hidden");
        } else {
            // Auto approve for other mock kiosks
            setTimeout(executePhysicalSwap, 1500);
        }
    }, 1200);
}

// Step 3: Run swap
function executePhysicalSwap() {
    document.getElementById("swap-host-sim-actions").classList.add("hidden");
    
    const stepSwap = document.getElementById("step-swap");
    stepSwap.className = "swap-step active";
    document.getElementById("swap-phase-lbl").textContent = "Swap complete! Drive safely.";
    
    setTimeout(() => {
        completeTransaction();
    }, 1000);
}

// Step 4: Finalize transactions and show success
function completeTransaction() {
    const swap = state.activeSwap;
    if (!swap) return;

    // Deduct wallet from driver
    state.driver.wallet -= swap.price;
    if (state.driver.wallet < 0) state.driver.wallet = 0;
    
    // Reset driver battery ranges
    state.driver.battery = 100;
    state.driver.range = 80;

    // Update wallet dashboard DOM
    document.getElementById("driver-wallet-val").textContent = `KES ${state.driver.wallet.toFixed(2)}`;
    updateDriverBatteryDOM();

    // Adjust Host state if swap happens at Mama Cynthia's
    if (swap.kiosk.id === "kio_mama_cynthia") {
        // 1. Swap host inventory: Change one "ready" battery slot to "low" (representing driver's old dead battery inserted), 
        // and decrement another slot or simulate swapping.
        const readySlot = state.host.rackSlots.find(s => s.status === "ready");
        const emptyOrChargingSlot = state.host.rackSlots.find(s => s.status === "empty" || s.status === "low");

        if (readySlot) {
            // Take the full battery out: make it empty
            readySlot.status = "empty";
            readySlot.pct = 0;
        }
        
        // Insert rider's dead battery: put in the empty/charging slot at 14%
        if (emptyOrChargingSlot) {
            emptyOrChargingSlot.status = "charging";
            emptyOrChargingSlot.pct = 14;
        } else {
            // fallback: create slot update
            const slotToReplace = state.host.rackSlots[2]; // bay 3
            slotToReplace.status = "charging";
            slotToReplace.pct = 14;
        }

        // 2. Add payout earnings to host
        state.host.earningsToday += swap.price;
        state.host.momoBalance += swap.price;

        // Render host view components
        renderRack();
        document.getElementById("host-earnings-today").textContent = `KES ${state.host.earningsToday.toFixed(2)}`;
        document.getElementById("host-momo-balance").textContent = `KES ${state.host.momoBalance.toFixed(2)}`;
    }

    // Hide progress modal
    document.getElementById("swap-progress-modal").classList.add("hidden");

    // Serialize confirmation packet
    const confirmParams = {
        DRV: state.driver.id,
        KIO: swap.kiosk.id,
        STATUS: "COMPLETE",
        BATT_OUT: "SLOT_04",
        BATT_IN: "SLOT_02"
    };
    const confirmPacket = serializePacket("SWAP_CONFIRM", confirmParams);
    logConsole(`[RX] Received swap completion confirmation: ${confirmPacket}`, "rx");
    updateTelemetrySize(confirmPacket);

    // Show Success Modal
    const successModal = document.getElementById("success-modal");
    document.getElementById("success-kiosk-name").textContent = swap.kiosk.name;
    document.getElementById("success-cost").textContent = `KES ${swap.price}.00`;
    successModal.classList.remove("hidden");
    
    // Clear state
    state.activeSwap = null;
}

// Update battery levels indicators in driver dashboard DOM
function updateDriverBatteryDOM() {
    const fillEl = document.getElementById("driver-battery-fill");
    const pctEl = document.getElementById("driver-battery-pct");
    const rangeEl = document.getElementById("driver-battery-range");
    const warningEl = document.getElementById("battery-critical-warning");

    if (fillEl) {
        fillEl.style.width = `${state.driver.battery}%`;
        // Color shifts based on state of charge
        if (state.driver.battery <= 20) {
            fillEl.style.backgroundColor = "var(--danger)";
            if (warningEl) warningEl.style.display = "block";
        } else if (state.driver.battery <= 50) {
            fillEl.style.backgroundColor = "var(--solar-yellow)";
            if (warningEl) warningEl.style.display = "none";
        } else {
            fillEl.style.backgroundColor = "var(--energy-green)";
            if (warningEl) warningEl.style.display = "none";
        }
    }

    if (pctEl) pctEl.textContent = `${state.driver.battery}%`;
    if (rangeEl) rangeEl.textContent = `Approx. ${state.driver.range} km left`;
}

// 8. INTERACTIVE SYSTEM CONTROLLERS

// Handle Location Selector Shift
document.getElementById("sim-location").addEventListener("change", (e) => {
    state.selectedLocationId = e.target.value;
    
    // Log location update packet
    const locParams = {
        DRV: state.driver.id,
        LOC: state.selectedLocationId
    };
    const packet = serializePacket("LOC_UPDATE", locParams);
    logConsole(`[TX] Simulating location broadcast: ${packet}`, "tx");
    updateTelemetrySize(packet);

    // Re-render local kiosks list
    renderKiosks();
});

// Handle Solar Intensity Slider shift
document.getElementById("solar-intensity").addEventListener("input", (e) => {
    state.solarIntensity = parseInt(e.target.value);
    document.getElementById("solar-intensity-val").textContent = `${state.solarIntensity}% (${state.solarIntensity > 50 ? "Peak Sun" : state.solarIntensity > 20 ? "Overcast" : "Grid Backup"})`;
    
    // Re-render views
    renderRack();
    renderKiosks();

    // Serialize power update packet
    const gridParams = {
        KIO: state.host.id,
        SOL_PCT: state.solarIntensity,
        GRID_FALLBACK: state.solarIntensity < 30 ? "YES" : "NO"
    };
    const packet = serializePacket("SOLAR_STATUS", gridParams);
    logConsole(`[TX] Station Telemetry update: ${packet}`, "system");
});

// Handle host online switch
document.getElementById("host-online-toggle").addEventListener("change", (e) => {
    state.host.online = e.target.checked;
    
    const label = document.getElementById("host-online-status");
    if (e.target.checked) {
        label.textContent = "Online";
        label.className = "host-online-label text-green";
        logConsole(`[HOST] Mama Cynthia's Solar Kiosk is now ONLINE`, "system");
    } else {
        label.textContent = "Offline";
        label.className = "host-online-label text-muted";
        logConsole(`[HOST] Mama Cynthia's Solar Kiosk is now OFFLINE`, "system");
    }

    // Refresh views to match online availability lists
    renderKiosks();
});

// Role Navigation
document.getElementById("role-driver-btn").addEventListener("click", () => {
    document.getElementById("role-driver-btn").classList.add("active");
    document.getElementById("role-host-btn").classList.remove("active");
    
    document.getElementById("driver-app-view").classList.remove("hidden");
    document.getElementById("host-app-view").classList.add("hidden");
    state.currentRole = "driver";
});

document.getElementById("role-host-btn").addEventListener("click", () => {
    document.getElementById("role-host-btn").classList.add("active");
    document.getElementById("role-driver-btn").classList.remove("active");
    
    document.getElementById("host-app-view").classList.remove("hidden");
    document.getElementById("driver-app-view").classList.add("hidden");
    state.currentRole = "host";
});

// Cancel MoMo PIN prompt
document.getElementById("momo-cancel-btn").addEventListener("click", () => {
    hideMomoModal();
    logConsole("[SYSTEM] Mobile Money Payment cancelled by rider.", "error");
});

// Authorize payment
document.getElementById("momo-confirm-btn").addEventListener("click", handleMomoSubmit);

// Host simulated approval button
document.getElementById("sim-host-approve-btn").addEventListener("click", executePhysicalSwap);

// Close success screen
document.getElementById("success-close-btn").addEventListener("click", () => {
    document.getElementById("success-modal").classList.add("hidden");
});

// Clear console logger
document.getElementById("clear-console-btn").addEventListener("click", () => {
    document.getElementById("console-output").innerHTML = "";
    logConsole("Console output cleared.", "system");
});

// Dynamic UI accordion toggle
document.querySelectorAll(".accordion-title").forEach(title => {
    title.addEventListener("click", () => {
        const item = title.parentElement;
        const active = item.classList.contains("active");
        
        // Close other items
        document.querySelectorAll(".accordion-item").forEach(el => el.classList.remove("active"));
        
        if (!active) {
            item.classList.add("active");
        }
    });
});

// Force Sync database simulator button
document.getElementById("force-sync-db-btn").addEventListener("click", () => {
    logConsole("[OFFLINE] Initiating database handshake with Kika-Charge central registries...", "system");
    
    const syncParams = {
        DRV: state.driver.id,
        VER: "1.08",
        DB_CSUM: "8E3D77A2"
    };
    const packet = serializePacket("SYNC_DB_REQ", syncParams);
    logConsole(`[TX] Broadcasting db sync: ${packet}`, "tx");
    updateTelemetrySize(packet);

    setTimeout(() => {
        const rsvParams = {
            STATUS: "OK",
            NEW_STATIONS: 0,
            LOCAL_DB: "VER_1.08_UPTODATE"
        };
        const respPacket = serializePacket("SYNC_DB_RESP", rsvParams);
        logConsole(`[RX] Handshake complete: ${respPacket}`, "rx");
        updateTelemetrySize(respPacket);
        
        logConsole("[OFFLINE] Offline database verification complete. 45 stations verified.", "system");
    }, 500);
});

// Initial boot settings
function init() {
    updateDriverBatteryDOM();
    renderKiosks();
    renderRack();
    
    // Set default accordion to open (first item)
    document.querySelector(".accordion-item").classList.add("active");
    
    logConsole("Kika-Charge simulation successfully booted.", "system");

    // Register Service Worker for PWA/offline access simulation
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                logConsole("[OFFLINE] Service Worker registered successfully.", "system");
            })
            .catch(err => {
                console.error("Service worker registration failed:", err);
            });
    }
}

window.onload = init;
