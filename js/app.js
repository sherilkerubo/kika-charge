// Kika-Charge Web Application Engine & State Manager

// ==================== 1. DATABASE & INITIAL STATE SCHEMAS ====================

const DEFAULT_KIOSKS = [
    {
        id: "kio_mama_cynthia",
        name: "Mama Cynthia's Solar Kiosk",
        locationId: "nairobi_west",
        landmark: "📍 Nairobi West, next to Airtel pole",
        online: true,
        basePrice: 150,
        solarActive: true,
        solarCapacityKW: 5.5,
        earningsToday: 1320.00,
        momoBalance: 3840.00,
        rackSlots: [
            { id: 1, pct: 100, status: "ready" },
            { id: 2, pct: 72, status: "charging" },
            { id: 3, pct: 0, status: "empty" },
            { id: 4, pct: 100, status: "ready" },
            { id: 5, pct: 35, status: "charging" },
            { id: 6, pct: 12, status: "low" }
        ]
    },
    {
        id: "kio_kamau_shop",
        name: "Kamau Electronics & Swap",
        locationId: "nairobi_west",
        landmark: "📍 Behind Shell Petrol Station",
        online: true,
        basePrice: 140,
        solarActive: true,
        solarCapacityKW: 8.0,
        earningsToday: 480.00,
        momoBalance: 1200.00,
        rackSlots: [
            { id: 1, pct: 100, status: "ready" },
            { id: 2, pct: 100, status: "ready" },
            { id: 3, pct: 85, status: "charging" },
            { id: 4, pct: 0, status: "empty" }
        ]
    },
    {
        id: "kio_matatu_hub",
        name: "Langata Matatu Stage Power",
        locationId: "nairobi_west",
        landmark: "📍 Next to boda-boda stage entrance",
        online: true,
        basePrice: 160,
        solarActive: false,
        solarCapacityKW: 0,
        earningsToday: 2400.00,
        momoBalance: 840.00,
        rackSlots: [
            { id: 1, pct: 100, status: "ready" },
            { id: 2, pct: 24, status: "low" }
        ]
    },
    {
        id: "kio_cbd_express",
        name: "CBD Boda Swap & Go",
        locationId: "cbd",
        landmark: "📍 Ronald Ngala St, opposite Naivas",
        online: true,
        basePrice: 170,
        solarActive: false,
        solarCapacityKW: 0,
        earningsToday: 3200.00,
        momoBalance: 900.00,
        rackSlots: [
            { id: 1, pct: 100, status: "ready" },
            { id: 2, pct: 100, status: "ready" }
        ]
    },
    {
        id: "kio_solar_karen_01",
        name: "Karen Green Charging Hub",
        locationId: "karen",
        landmark: "📍 Karen Shopping Center, back alley",
        online: true,
        basePrice: 130,
        solarActive: true,
        solarCapacityKW: 12.0,
        earningsToday: 950.00,
        momoBalance: 2400.00,
        rackSlots: [
            { id: 1, pct: 100, status: "ready" },
            { id: 2, pct: 100, status: "ready" },
            { id: 3, pct: 92, status: "charging" },
            { id: 4, pct: 45, status: "charging" }
        ]
    }
];

const DEFAULT_DRIVER = {
    id: "drv_204",
    name: "Rider #204 - Kamau",
    wallet: 420.00,
    battery: 14,
    range: 9, // km
    currentLocation: "nairobi_west"
};

const DEFAULT_TRANSACTIONS = [
    { id: "TXN_8F9D01", type: "swap", station: "Mama Cynthia's Solar Kiosk", amount: 120, date: "2026-06-03 11:32" },
    { id: "TXN_7E4D12", type: "topup", phone: "0712345678", amount: 300, date: "2026-06-03 09:15" }
];

// Local state tracking variables (runtime cache)
let kiosks = [];
let driver = {};
let transactions = [];
let solarIntensity = 85; // Percent intensity index

let activeSwapState = null;

// ==================== 2. LOCALSTORAGE STORAGE CONTROLLERS ====================

function initDatabase() {
    if (!localStorage.getItem("kika_kiosks")) {
        localStorage.setItem("kika_kiosks", JSON.stringify(DEFAULT_KIOSKS));
    }
    if (!localStorage.getItem("kika_driver")) {
        localStorage.setItem("kika_driver", JSON.stringify(DEFAULT_DRIVER));
    }
    if (!localStorage.getItem("kika_transactions")) {
        localStorage.setItem("kika_transactions", JSON.stringify(DEFAULT_TRANSACTIONS));
    }

    // Load into runtime memory
    kiosks = JSON.parse(localStorage.getItem("kika_kiosks"));
    driver = JSON.parse(localStorage.getItem("kika_driver"));
    transactions = JSON.parse(localStorage.getItem("kika_transactions"));
}

function saveKiosksToDB() {
    localStorage.setItem("kika_kiosks", JSON.stringify(kiosks));
}

function saveDriverToDB() {
    localStorage.setItem("kika_driver", JSON.stringify(driver));
}

function saveTransactionsToDB() {
    localStorage.setItem("kika_transactions", JSON.stringify(transactions));
}

// ==================== 3. TELEMETRY SERIALIZER & DEBUGGER ====================

function logConsole(message, type = "system") {
    const consoleOutput = document.getElementById("footer-console-log");
    if (!consoleOutput) return;

    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const logDiv = document.createElement("div");
    logDiv.className = `c-log ${type}-log`;
    logDiv.textContent = `[${time}] ${message}`;
    
    consoleOutput.appendChild(logDiv);
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function updateTelemetrySize(packetText) {
    const sizeBytes = new Blob([packetText]).size;
    const sizeKB = (sizeBytes / 1024).toFixed(3);
    
    const sizeEl = document.getElementById("footer-data-pkg-lbl");
    if (sizeEl) {
        sizeEl.textContent = `Packet: ${sizeBytes} B (${sizeKB} KB)`;
    }
}

// Delimiter-based serialization (Kika Protocol: Action|Param1:Val|Param2:Val)
function serializePacket(action, params) {
    let packet = `KIKA:${action}`;
    for (const [key, value] of Object.entries(params)) {
        packet += `|${key}:${value}`;
    }
    return packet;
}

// ==================== 4. REAL-TIME CHARGING SIMULATOR (ticker loop) ====================

function startBackgroundChargingTicker() {
    // Battery rack charges incrementally every 3 seconds
    setInterval(() => {
        let databaseChanged = false;

        kiosks.forEach(k => {
            // Charging speed depends on solar active and current solar output
            if (!k.online) return;

            let solarChargeSpeed = 1; // Default grid rate
            if (k.solarActive) {
                // High solar intensity accelerates charging rates
                if (solarIntensity > 75) solarChargeSpeed = 4;
                else if (solarIntensity > 40) solarChargeSpeed = 2;
                else solarChargeSpeed = 1;
            }

            k.rackSlots.forEach(slot => {
                if (slot.status === "charging" || slot.status === "low") {
                    slot.pct += solarChargeSpeed;
                    
                    if (slot.pct >= 100) {
                        slot.pct = 100;
                        slot.status = "ready";
                        
                        logConsole(`[SYSTEM] Bay 0${slot.id} at ${k.name} has finished charging to 100%.`, "rx");
                    }
                    databaseChanged = true;
                }
            });
        });

        if (databaseChanged) {
            saveKiosksToDB();
            // Re-render depending on which view is currently active
            if (!document.getElementById("view-host").classList.contains("hidden")) {
                renderHostRack();
            }
            if (!document.getElementById("view-rider").classList.contains("hidden")) {
                renderRiderStations();
            }
        }
    }, 3000);
}

// ==================== 5. COMPUTATIONAL LOGICS ====================

function getDynamicPrice(kiosk) {
    if (!kiosk.solarActive) return kiosk.basePrice;
    
    // Scale discount dynamically: 30% off during peak solar production (100% intensity)
    const discount = (solarIntensity / 100) * 0.30;
    return Math.round(kiosk.basePrice * (1 - discount));
}

function countAvailableBatteries(kiosk) {
    return kiosk.rackSlots.filter(s => s.status === "ready").length;
}

function showToast(message, type = "success") {
    const toast = document.getElementById("global-toast");
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast ${type === "error" ? "error-toast" : ""}`;
    toast.classList.remove("hidden");

    setTimeout(() => {
        toast.classList.add("hidden");
    }, 3000);
}

// ==================== 6. RENDERING COMPONENTS ====================

// RIDER PORTAL: Render kiosks list
function renderRiderStations() {
    const listContainer = document.getElementById("rider-stations-list");
    const locationFilter = document.getElementById("station-filter-location").value;
    const searchVal = document.getElementById("station-search-input").value.toLowerCase();

    if (!listContainer) return;
    listContainer.innerHTML = "";

    // Load current online kiosks
    const activeKiosks = kiosks.filter(k => k.online);

    // Apply search filters
    const filtered = activeKiosks.filter(k => {
        const matchesLocation = locationFilter === "all" || k.locationId === locationFilter;
        const matchesSearch = k.name.toLowerCase().includes(searchVal) || k.landmark.toLowerCase().includes(searchVal);
        return matchesLocation && matchesSearch;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="ledger-empty">No active stations found matching your search.</div>`;
        return;
    }

    filtered.forEach(k => {
        const price = getDynamicPrice(k);
        const availCount = countAvailableBatteries(k);
        const isSolarActive = k.solarActive && solarIntensity > 35;
        
        // Calculate dynamic mock distance relative to driver location
        let distance = 250;
        if (k.locationId !== driver.currentLocation) {
            distance = 1800; // farther away
        } else {
            // Assign different distance offsets
            if (k.id === "kio_mama_cynthia") distance = 120;
            else if (k.id === "kio_kamau_shop") distance = 310;
            else if (k.id === "kio_matatu_hub") distance = 490;
        }

        const card = document.createElement("div");
        card.className = "station-card";
        card.onclick = () => selectStationForSwap(k);

        card.innerHTML = `
            <div class="station-card-header">
                <div class="station-info">
                    <h4>${k.name} <span style="color:var(--energy-green);">✓</span></h4>
                    <p>${k.landmark}</p>
                </div>
                <span class="station-dist-badge">${distance}m</span>
            </div>
            <div class="station-card-body">
                <div class="station-meta-col">
                    <span class="meta-lbl">Batteries</span>
                    <span class="meta-val ${availCount > 0 ? 'text-green' : 'text-danger'}">${availCount} Ready</span>
                </div>
                <div class="station-meta-col">
                    <span class="meta-lbl">Empty Slots</span>
                    <span class="meta-val">${k.rackSlots.filter(s => s.status === 'empty').length} Available</span>
                </div>
                <div class="station-meta-col text-right">
                    ${isSolarActive ? `<span class="solar-badge-pill">☀️ Solar Peak</span>` : `<span class="grid-badge-pill">🔌 Grid Mode</span>`}
                    <span class="price-text-glow">KES ${price}</span>
                </div>
            </div>
            <button class="btn btn-accent btn-block btn-sm" style="margin-top: 4px;">⚡ Confirm Swap</button>
        `;
        listContainer.appendChild(card);
    });
}

// RIDER PORTAL: Render transaction logs
function renderRiderLedger() {
    const container = document.getElementById("rider-ledger-list");
    if (!container) return;

    container.innerHTML = "";
    
    // Sort transactions by date descending
    const riderTxs = transactions.filter(t => t.type === "swap" || t.type === "topup");
    
    if (riderTxs.length === 0) {
        container.innerHTML = `<div class="ledger-empty">No transactions recorded.</div>`;
        return;
    }

    riderTxs.forEach(t => {
        const item = document.createElement("div");
        item.className = "ledger-item";

        if (t.type === "swap") {
            item.innerHTML = `
                <div class="ledger-meta">
                    <span class="ledger-title">Battery Swap</span>
                    <span class="ledger-sub">${t.station} • ${t.date}</span>
                </div>
                <span class="ledger-amt spend">- KES ${t.amount}</span>
            `;
        } else {
            item.innerHTML = `
                <div class="ledger-meta">
                    <span class="ledger-title">Wallet Top-Up</span>
                    <span class="ledger-sub">Via MoMo Number ${t.phone}</span>
                </div>
                <span class="ledger-amt earn">+ KES ${t.amount}</span>
            `;
        }
        container.appendChild(item);
    });
}

// HOST PORTAL: Render bays
function renderHostRack() {
    const container = document.getElementById("host-battery-rack");
    if (!container) return;

    container.innerHTML = "";

    const activeHost = kiosks.find(k => k.id === "kio_mama_cynthia");
    if (!activeHost) return;

    activeHost.rackSlots.forEach(slot => {
        const bay = document.createElement("div");
        bay.className = `host-rack-slot slot-${slot.status}`;
        bay.onclick = () => manageHostSlot(slot.id);

        let statusTxt = "Empty Bay";
        if (slot.status === "ready") statusTxt = "100% Ready";
        else if (slot.status === "charging") statusTxt = "Charging";
        else if (slot.status === "low") statusTxt = "Low Cell";

        bay.innerHTML = `
            <span class="host-slot-num">BAY 0${slot.id}</span>
            <div class="host-slot-battery-box">
                <div class="host-slot-battery-fill" style="width: ${slot.pct}%;"></div>
            </div>
            <span class="host-slot-pct">${slot.pct}%</span>
            <span class="host-slot-status">${statusTxt}</span>
        `;
        container.appendChild(bay);
    });

    // Update solar capacities
    const outputKW = ((solarIntensity / 100) * activeHost.solarCapacityKW).toFixed(1);
    document.getElementById("host-solar-output-kw").textContent = `${outputKW} kW`;
    document.getElementById("host-calculated-price").textContent = `KES ${getDynamicPrice(activeHost)}`;
}

// HOST PORTAL: Render activity logs
function renderHostLedger() {
    const container = document.getElementById("host-ledger-list");
    if (!container) return;

    container.innerHTML = "";

    const activeHost = kiosks.find(k => k.id === "kio_mama_cynthia");
    if (!activeHost) return;

    // Filter transaction logs relevant to this station
    const logs = transactions.filter(t => (t.type === "swap" && t.station === activeHost.name) || t.type === "withdrawal");

    if (logs.length === 0) {
        container.innerHTML = `<div class="ledger-empty">No activity logs recorded.</div>`;
        return;
    }

    logs.forEach(t => {
        const item = document.createElement("div");
        item.className = "ledger-item";

        if (t.type === "swap") {
            item.innerHTML = `
                <div class="ledger-meta">
                    <span class="ledger-title">Driver Swap Received</span>
                    <span class="ledger-sub">ID: ${t.id} • ${t.date}</span>
                </div>
                <span class="ledger-amt earn">+ KES ${t.amount}</span>
            `;
        } else {
            item.innerHTML = `
                <div class="ledger-meta">
                    <span class="ledger-title">MoMo Withdrawal</span>
                    <span class="ledger-sub">To Mobile Number: ${t.phone}</span>
                </div>
                <span class="ledger-amt spend">- KES ${t.amount}</span>
            `;
        }
        container.appendChild(item);
    });
}

// ==================== 7. DYNAMIC SWAP FLOW CONTROLLER ====================

function selectStationForSwap(kiosk) {
    // Check if station has any ready batteries
    const readyCount = countAvailableBatteries(kiosk);
    if (readyCount === 0) {
        showToast("No fully charged batteries available at this station. Select another station.", "error");
        logConsole(`[ERROR] Swap request failed. ${kiosk.name} has 0 ready batteries.`, "error");
        return;
    }

    const price = getDynamicPrice(kiosk);

    // Verify driver has enough wallet balance
    if (driver.wallet < price) {
        showToast("Insufficient M-Pesa balance. Please top up your wallet first.", "error");
        return;
    }

    activeSwapState = {
        kioskId: kiosk.id,
        kioskName: kiosk.name,
        price: price
    };

    // Serialize Query Request
    const queryPkg = {
        DRV: driver.id,
        LOC: driver.currentLocation,
        CHK_KIO: kiosk.id
    };
    const packet = serializePacket("QUERY_STATION", queryPkg);
    logConsole(`[TX] Pinging kiosk telemetry: ${packet}`, "tx");
    updateTelemetrySize(packet);

    // Spawn Checkout
    setTimeout(() => {
        const respPkg = {
            KIO: kiosk.id,
            ONLINE: "YES",
            BATT_READY: readyCount,
            SWAP_FEE: price
        };
        const respPacket = serializePacket("RESP_STATION", respPkg);
        logConsole(`[RX] Received response: ${respPacket}`, "rx");
        updateTelemetrySize(respPacket);

        // Open M-Pesa Authorization Popup
        document.getElementById("momo-kiosk-name").textContent = kiosk.name;
        document.getElementById("momo-pay-val").textContent = `KES ${price}.00`;
        document.getElementById("modal-momo-pay").classList.remove("hidden");
        document.getElementById("momo-auth-pin").value = "";
        document.getElementById("momo-auth-pin").focus();
    }, 400);
}

function processMomoAuthorization() {
    const pinVal = document.getElementById("momo-auth-pin").value;
    if (pinVal.length < 4) {
        alert("Please enter a valid 4-digit PIN.");
        return;
    }

    document.getElementById("modal-momo-pay").classList.add("hidden");
    
    // Spawn Swap progress modal
    document.getElementById("progress-station-title").textContent = activeSwapState.kioskName;
    document.getElementById("modal-swap-progress").classList.remove("hidden");

    // Telemetry request
    const payParams = {
        DRV: driver.id,
        KIO: activeSwapState.kioskId,
        VAL: activeSwapState.price,
        TX_REF: "MOMO_" + Math.random().toString(36).substr(2, 8).toUpperCase()
    };
    const packet = serializePacket("AUTH_PAYMENT", payParams);
    logConsole(`[TX] Authorizing wallet transaction: ${packet}`, "tx");
    updateTelemetrySize(packet);

    // Progress flow stages
    const step1 = document.getElementById("chk-step-1");
    const step2 = document.getElementById("chk-step-2");
    const step3 = document.getElementById("chk-step-3");
    const phaseLabel = document.getElementById("progress-phase-msg");

    step1.className = "checkpoint-item active";
    step2.className = "checkpoint-item";
    step3.className = "checkpoint-item";
    phaseLabel.textContent = "Unlocking battery slot...";

    setTimeout(() => {
        // Step 2: Unlocking slot
        step2.className = "checkpoint-item active";
        phaseLabel.textContent = "Remove dead battery and insert fully charged cell...";

        // If the swap is happening at Mama Cynthia's Solar Kiosk (the simulated host portal),
        // we can prompt a simulation bypass button so the user can click to confirm the physical action.
        if (activeSwapState.kioskId === "kio_mama_cynthia") {
            document.getElementById("host-sim-actions-prompt").classList.remove("hidden");
        } else {
            // Auto complete for other background shops
            setTimeout(() => {
                step3.className = "checkpoint-item active";
                phaseLabel.textContent = "Finalizing swap handshake...";
                setTimeout(finalizePhysicalSwap, 1000);
            }, 2000);
        }
    }, 1200);
}

function finalizePhysicalSwap() {
    document.getElementById("host-sim-actions-prompt").classList.add("hidden");
    document.getElementById("modal-swap-progress").classList.add("hidden");

    const swap = activeSwapState;
    if (!swap) return;

    // 1. Update Driver State
    driver.wallet -= swap.price;
    driver.battery = 100;
    driver.range = 80;
    saveDriverToDB();

    // 2. Update Kiosk Database State
    const station = kiosks.find(k => k.id === swap.kioskId);
    if (station) {
        // Remove a 100% battery (disconnect from rack)
        const readySlot = station.rackSlots.find(s => s.status === "ready");
        if (readySlot) {
            readySlot.status = "empty";
            readySlot.pct = 0;
        }

        // Insert rider's dead battery (charging at 14% SOC)
        const emptySlot = station.rackSlots.find(s => s.status === "empty");
        if (emptySlot) {
            emptySlot.status = "charging";
            emptySlot.pct = 14;
        } else {
            // override a bay or create new
            if (station.rackSlots.length > 0) {
                station.rackSlots[0].status = "charging";
                station.rackSlots[0].pct = 14;
            }
        }

        // Add revenues
        station.earningsToday += swap.price;
        station.momoBalance += swap.price;
        saveKiosksToDB();
    }

    // 3. Register transaction ledger
    const txId = "TXN_" + Math.random().toString(36).substr(2, 8).toUpperCase();
    const newTx = {
        id: txId,
        type: "swap",
        station: swap.kioskName,
        amount: swap.price,
        date: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    transactions.unshift(newTx);
    saveTransactionsToDB();

    // Re-render boards
    updateDriverDashboardDOM();
    renderRiderStations();
    renderRiderLedger();
    renderHostRack();
    renderHostLedger();

    // Telemetry confirmations
    const confirmPkg = {
        DRV: driver.id,
        KIO: swap.kioskId,
        STATUS: "SWAP_SUCCESS",
        TX_REF: txId
    };
    const confirmPacket = serializePacket("CONFIRM_SWAP", confirmPkg);
    logConsole(`[RX] Received confirmation: ${confirmPacket}`, "rx");
    updateTelemetrySize(confirmPacket);

    // Open Success Modal
    document.getElementById("success-station-lbl").textContent = swap.kioskName;
    document.getElementById("receipt-cost-val").textContent = `KES ${swap.price}.00`;
    document.getElementById("receipt-ref-code").textContent = txId;
    document.getElementById("modal-swap-success").classList.remove("hidden");

    showToast("Battery swap complete!");
    activeSwapState = null;
}

// ==================== 8. HOST PORTAL: RACK BAY ACTIONS ====================

function manageHostSlot(slotId) {
    const host = kiosks.find(k => k.id === "kio_mama_cynthia");
    if (!host) return;

    const slot = host.rackSlots.find(s => s.id === slotId);
    if (!slot) return;

    // Show custom action prompt for slot configuration
    const act = confirm(`Bay 0${slotId} is currently [${slot.status.toUpperCase()} (${slot.pct}%)].\n\n- Click OK to cycle states:\n  (Ready -> Charging -> Empty -> Ready)`);
    
    if (act) {
        if (slot.status === "ready") {
            slot.status = "charging";
            slot.pct = 20;
        } else if (slot.status === "charging" || slot.status === "low") {
            slot.status = "empty";
            slot.pct = 0;
        } else {
            slot.status = "ready";
            slot.pct = 100;
        }
        
        saveKiosksToDB();
        renderHostRack();
        renderRiderStations();
        
        // Log telemetry
        const telPkg = {
            KIO: host.id,
            BAY: slotId,
            STATE: slot.status,
            SOC: slot.pct
        };
        const packet = serializePacket("BAY_STATUS_CHANGE", telPkg);
        logConsole(`[TX] Broadasting hardware update: ${packet}`, "system");
    }
}

function handleAddNewBay() {
    const host = kiosks.find(k => k.id === "kio_mama_cynthia");
    if (!host) return;

    if (host.rackSlots.length >= 8) {
        alert("Maximum station charging rack capacity reached (8 bays max).");
        return;
    }

    const nextId = host.rackSlots.length + 1;
    host.rackSlots.push({ id: nextId, pct: 0, status: "empty" });
    
    saveKiosksToDB();
    renderHostRack();
    
    showToast("Added Bay 0" + nextId + " to charging rack.");
    logConsole(`[SYSTEM] Mama Cynthia's Solar Kiosk expanded rack capacity to ${nextId} slots.`, "system");
}

// ==================== 9. SUBMIT FORM ACTIONS ====================

// RIDER: Mobile Money topup request
document.getElementById("rider-topup-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const phone = document.getElementById("topup-phone").value;
    const amount = parseInt(document.getElementById("topup-amount").value);

    // Simulate SMS transaction authorization
    const topupPkg = {
        DRV: driver.id,
        PHONE: phone,
        VAL: amount
    };
    const packet = serializePacket("TOPUP_REQ", topupPkg);
    logConsole(`[TX] Requesting wallet funding: ${packet}`, "tx");
    updateTelemetrySize(packet);

    setTimeout(() => {
        // Add to wallet balance
        driver.wallet += amount;
        saveDriverToDB();

        // Add to transaction log
        const txId = "TXN_" + Math.random().toString(36).substr(2, 8).toUpperCase();
        transactions.unshift({
            id: txId,
            type: "topup",
            phone: phone,
            amount: amount,
            date: new Date().toISOString().replace('T', ' ').substring(0, 16)
        });
        saveTransactionsToDB();

        // Re-render
        updateDriverDashboardDOM();
        renderRiderLedger();

        // Telemetry response
        const respPkg = {
            STATUS: "SUCCESS",
            ADD_VAL: amount,
            NEW_BAL: driver.wallet,
            REF: txId
        };
        const respPacket = serializePacket("TOPUP_CONFIRM", respPkg);
        logConsole(`[RX] Received top-up authorization confirmation: ${respPacket}`, "rx");
        updateTelemetrySize(respPacket);

        showToast(`M-Pesa top-up of KES ${amount} successful!`);
        document.getElementById("topup-amount").value = "";
    }, 600);
});

// HOST: Request cash payouts
document.getElementById("host-withdraw-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const phone = document.getElementById("withdraw-phone").value;
    const host = kiosks.find(k => k.id === "kio_mama_cynthia");
    
    if (!host) return;
    const amount = host.momoBalance;

    if (amount <= 0) {
        showToast("Payout balance is KES 0.00. No funds to withdraw.", "error");
        return;
    }

    // Payout telemetry request
    const payPkg = {
        KIO: host.id,
        PHONE: phone,
        VAL: amount
    };
    const packet = serializePacket("PAYOUT_REQUEST", payPkg);
    logConsole(`[TX] Broadcasting payout query: ${packet}`, "tx");
    updateTelemetrySize(packet);

    setTimeout(() => {
        // Reset host balances
        host.momoBalance = 0;
        saveKiosksToDB();

        // Add to transactions ledger
        transactions.unshift({
            id: "TXN_" + Math.random().toString(36).substr(2, 8).toUpperCase(),
            type: "withdrawal",
            phone: phone,
            amount: amount,
            date: new Date().toISOString().replace('T', ' ').substring(0, 16)
        });
        saveTransactionsToDB();

        // Re-render host boards
        document.getElementById("host-momo-payout-bal").textContent = "KES 0.00";
        renderHostLedger();

        const respPkg = {
            STATUS: "PAID",
            PHONE: phone,
            AMT: amount
        };
        const respPacket = serializePacket("PAYOUT_CONFIRM", respPkg);
        logConsole(`[RX] Payout successfully deposited to wallet: ${respPacket}`, "rx");
        updateTelemetrySize(respPacket);

        showToast(`Successfully paid KES ${amount.toFixed(2)} to ${phone}.`);
        document.getElementById("withdraw-phone").value = "";
    }, 700);
});

// HOST: Save Station profile settings
document.getElementById("host-profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("profile-kiosk-name").value;
    const landmark = document.getElementById("profile-landmark").value;
    const basePrice = parseInt(document.getElementById("profile-base-price").value);
    const locationId = document.getElementById("profile-location-id").value;

    const host = kiosks.find(k => k.id === "kio_mama_cynthia");
    if (host) {
        host.name = name;
        host.landmark = landmark;
        host.basePrice = basePrice;
        host.locationId = locationId;
        saveKiosksToDB();

        // Update titles on DOM
        document.getElementById("host-kiosk-title").textContent = name;
        document.getElementById("host-kiosk-landmark").textContent = landmark;

        renderHostRack();
        renderRiderStations();

        showToast("Station configuration updated successfully.");
        
        // Log update
        const profilePkg = {
            KIO: host.id,
            NAME: name.replace(/ /g, "_"),
            PRICE: basePrice,
            LOC: locationId
        };
        const packet = serializePacket("UPDATE_STATION_PROFILE", profilePkg);
        logConsole(`[TX] Broadcasting profile update: ${packet}`, "system");
    }
});

// ==================== 10. SYSTEM CONTROLS & ROUTING ====================

function updateDriverDashboardDOM() {
    const fillEl = document.getElementById("rider-batt-fill");
    const pctEl = document.getElementById("rider-batt-pct");
    const rangeEl = document.getElementById("rider-batt-range");
    const warningEl = document.getElementById("rider-batt-warning");
    const walletEl = document.getElementById("rider-wallet-val");

    if (walletEl) walletEl.textContent = `KES ${driver.wallet.toFixed(2)}`;
    if (pctEl) pctEl.textContent = `${driver.battery}%`;
    if (rangeEl) rangeEl.textContent = `Approx. ${driver.range} km remaining`;

    if (fillEl) {
        fillEl.style.width = `${driver.battery}%`;
        if (driver.battery <= 20) {
            fillEl.style.backgroundColor = "var(--danger)";
            if (warningEl) warningEl.style.display = "block";
        } else if (driver.battery <= 50) {
            fillEl.style.backgroundColor = "var(--solar-yellow)";
            if (warningEl) warningEl.style.display = "none";
        } else {
            fillEl.style.backgroundColor = "var(--energy-green)";
            if (warningEl) warningEl.style.display = "none";
        }
    }
}

// Router View switcher
function navigateTo(viewId) {
    document.getElementById("view-landing").classList.add("hidden");
    document.getElementById("view-rider").classList.add("hidden");
    document.getElementById("view-host").classList.add("hidden");

    document.getElementById(viewId).classList.remove("hidden");

    const badge = document.getElementById("current-role-badge");
    const navBtn = document.getElementById("change-role-nav-btn");

    if (viewId === "view-landing") {
        badge.textContent = "P2P Network";
        badge.className = "badge-role";
        navBtn.classList.add("hidden");
    } else if (viewId === "view-rider") {
        badge.textContent = "Driver Portal";
        badge.className = "badge-role rider";
        navBtn.classList.remove("hidden");
        
        // Refresh Rider Portal views
        renderRiderStations();
        renderRiderLedger();
        updateDriverDashboardDOM();
    } else if (viewId === "view-host") {
        badge.textContent = "Solar Host";
        badge.className = "badge-role host";
        navBtn.classList.remove("hidden");

        // Refresh Host Portal views
        renderHostRack();
        renderHostLedger();
    }
}

// Solar slide controls
document.getElementById("host-solar-slider").addEventListener("input", (e) => {
    solarIntensity = parseInt(e.target.value);
    
    const sliderLabel = document.getElementById("host-solar-val-display");
    const solarIndicatorHeader = document.getElementById("header-solar-intensity");
    
    let text = `${solarIntensity}% (Overcast Grid Mode)`;
    if (solarIntensity > 75) text = `${solarIntensity}% (Peak Solar Surplus)`;
    else if (solarIntensity > 40) text = `${solarIntensity}% (Moderate Sun)`;

    sliderLabel.textContent = text;
    solarIndicatorHeader.textContent = `Solar Index: ${solarIntensity}%`;

    renderHostRack();
    renderRiderStations();

    // Log solar update packet
    const solPkg = {
        SOL: solarIntensity,
        GRID_BACKUP: solarIntensity < 30 ? "YES" : "NO"
    };
    const packet = serializePacket("SOLAR_INDEX_UPDATE", solPkg);
    logConsole(`[TX] Broadcasting grid telemetry update: ${packet}`, "system");
});

// Online toggle controls
document.getElementById("host-toggle-online").addEventListener("change", (e) => {
    const isOnline = e.target.checked;
    const label = document.getElementById("host-toggle-status-text");

    const host = kiosks.find(k => k.id === "kio_mama_cynthia");
    if (host) {
        host.online = isOnline;
        saveKiosksToDB();
    }

    if (isOnline) {
        label.textContent = "Online";
        label.className = "toggle-status-lbl text-green";
        showToast("Station is now online & searchable.");
        logConsole("[HOST] Mama Cynthia's Solar Kiosk status set to ONLINE.", "system");
    } else {
        label.textContent = "Offline";
        label.className = "toggle-status-lbl text-muted";
        showToast("Station is now offline.");
        logConsole("[HOST] Mama Cynthia's Solar Kiosk status set to OFFLINE.", "system");
    }

    renderRiderStations();
});

// Trigger directory searches
document.getElementById("station-search-input").addEventListener("input", renderRiderStations);
document.getElementById("station-filter-location").addEventListener("change", (e) => {
    driver.currentLocation = e.target.value === "all" ? "nairobi_west" : e.target.value;
    saveDriverToDB();

    renderRiderStations();
});

// Navigation bindings
document.getElementById("select-rider-card").addEventListener("click", () => navigateTo("view-rider"));
document.getElementById("select-host-card").addEventListener("click", () => navigateTo("view-host"));
document.getElementById("change-role-nav-btn").addEventListener("click", () => navigateTo("view-landing"));
document.getElementById("header-logo-btn").addEventListener("click", () => navigateTo("view-landing"));

// Console logging accordion toggle
document.getElementById("toggle-console-btn").addEventListener("click", (e) => {
    // Avoid toggling when clicking the clear button
    if (e.target.id === "btn-clear-footer-console") return;

    const tray = document.querySelector(".telemetry-bar-console");
    tray.classList.toggle("open");
});

document.getElementById("btn-clear-footer-console").addEventListener("click", () => {
    document.getElementById("footer-console-log").innerHTML = "";
    logConsole("Console outputs cleared.", "system");
});

// Modal bindings
document.getElementById("btn-cancel-momo").addEventListener("click", () => {
    document.getElementById("modal-momo-pay").classList.add("hidden");
    logConsole("[SYSTEM] Payment authorization cancelled by rider.", "error");
    activeSwapState = null;
});

document.getElementById("btn-confirm-momo").addEventListener("click", processMomoAuthorization);
document.getElementById("btn-sim-host-approve").addEventListener("click", () => {
    const step3 = document.getElementById("chk-step-3");
    const phaseLabel = document.getElementById("progress-phase-msg");

    step3.className = "checkpoint-item active";
    phaseLabel.textContent = "Swap complete! Drive safely.";
    setTimeout(finalizePhysicalSwap, 1000);
});

document.getElementById("btn-close-success-modal").addEventListener("click", () => {
    document.getElementById("modal-swap-success").classList.add("hidden");
});

document.getElementById("host-add-bay-btn").addEventListener("click", handleAddNewBay);

// Initialize application
function boot() {
    initDatabase();
    
    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered.'))
            .catch(err => console.log('Service Worker registration failed.', err));
    }

    // Set count statistics
    document.getElementById("total-registered-kiosks").textContent = kiosks.length;

    // Load initial views
    navigateTo("view-landing");
    
    // Start background simulation loops
    startBackgroundChargingTicker();
    
    logConsole("Kika-Charge fully functional application initialized.", "system");
}

window.onload = boot;
// ==================== REGISTRATION ENGINE CONTROLLERS ====================

document.addEventListener('DOMContentLoaded', () => {
    const viewLanding = document.getElementById('view-landing');
    const viewRider = document.getElementById('view-rider');
    const viewHost = document.getElementById('view-host');
    const roleBadge = document.getElementById('current-role-badge');
    const logoutBtn = document.getElementById('change-role-nav-btn');

    // DOM Logger utility matching your existing telemetry log pipeline
    function logToConsole(message, type = 'system-log') {
        const consoleLog = document.getElementById('footer-console-log');
        if (consoleLog) {
            const entry = document.createElement('div');
            entry.className = `c-log ${type}`;
            entry.textContent = `[${type.toUpperCase()}] ${message}`;
            consoleLog.appendChild(entry);
            consoleLog.scrollTop = consoleLog.scrollHeight;
        }
    }

    // Driver Sign-Up Handler
    const driverForm = document.getElementById('driver-registration-form');
    if (driverForm) {
        driverForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                name: document.getElementById('reg-driver-name').value,
                phone: document.getElementById('reg-driver-phone').value,
                vehicle: document.getElementById('reg-driver-vehicle').value
            };

            try {
                const response = await fetch('/api/register-driver', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const result = await response.json();
                    logToConsole(`Driver registered successfully. ID: ${result.driver.id}`, 'system-log');

                    // Dynamically map values into existing DOM framework elements
                    document.getElementById('rider-profile-name').textContent = `${result.driver.name} (${payload.phone})`;
                    document.getElementById('rider-wallet-val').textContent = `KES 0.00`;
                    
                    // View State Transformation matching your layout constraints
                    viewLanding.classList.add('hidden');
                    viewRider.classList.remove('hidden');
                    roleBadge.textContent = 'Driver Portal';
                    roleBadge.className = 'badge-role';
                    if (logoutBtn) logoutBtn.classList.remove('hidden');
                }
            } catch (error) {
                logToConsole(`Driver registration communication error.`, 'offline');
            }
        });
    }

    // Kiosk Host Sign-Up Handler
    const hostForm = document.getElementById('host-registration-form');
    if (hostForm) {
        hostForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const payload = {
                name: document.getElementById('reg-host-name').value,
                landmark: document.getElementById('reg-host-landmark').value,
                location: document.getElementById('reg-host-location').value
            };

            try {
                const response = await fetch('/api/register-host', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const result = await response.json();
                    logToConsole(`Solar Host registered. Station: ${result.host.name}`, 'system-log');

                    // Dynamically map values into existing DOM framework elements
                    document.getElementById('host-kiosk-title').textContent = result.host.name;
                    document.getElementById('host-kiosk-landmark').textContent = `📍 ${result.host.landmark}`;
                    document.getElementById('profile-kiosk-name').value = result.host.name;
                    document.getElementById('profile-landmark').value = result.host.landmark;
                    document.getElementById('profile-location-id').value = result.host.location;
                    document.getElementById('host-earn-today').textContent = `KES 0.00`;
                    document.getElementById('host-momo-payout-bal').textContent = `KES 0.00`;

                    // View State Transformation matching your layout constraints
                    viewLanding.classList.add('hidden');
                    viewHost.classList.remove('hidden');
                    roleBadge.textContent = 'Solar Host';
                    roleBadge.className = 'badge-role host-bg';
                    if (logoutBtn) logoutBtn.classList.remove('hidden');
                }
            } catch (error) {
                logToConsole(`Host registration communication error.`, 'offline');
            }
        });
    }

    // Wire standard Switch Portal logout navigation button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            viewRider.classList.add('hidden');
            viewHost.classList.add('hidden');
            viewLanding.classList.remove('hidden');
            logoutBtn.classList.add('hidden');
            roleBadge.textContent = 'P2P Network';
            roleBadge.className = 'badge-role';
        });
    }
});