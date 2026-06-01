// Configuración de Google Apps Script
// Reemplaza con la URL de tu web app desplegada
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhBn67HbAVtreCDHP67Fz2K_mIgwR83XFv2_Nn-ZjijzVxSJoyAlfZbWGyuC_g9rCt/exec';

// Usuarios autorizados
const USUARIOS = {
    javier: 'jav2385',
    toshio: 'tss8127'
};

// Configuración de gastos fijos
const GASTOS_FIJOS = {
    casa: { nombre: 'Casa', javier: 50, toshio: 50, montoMensual: 233.87 },
    carro: { nombre: 'Carro', javier: 50, toshio: 50, montoMensual: 228 },
    prestamo: { nombre: 'Préstamo', javier: 50, toshio: 50, montoMensual: 138.86 },
    luz: { nombre: 'Luz', javier: 50, toshio: 50, montoMensual: 34 },
    agua: { nombre: 'Agua', javier: 50, toshio: 50, montoMensual: 7 },
    basura: { nombre: 'Basura', javier: 50, toshio: 50, montoMensual: 20 },
    telefono: { nombre: 'Teléfono', javier: 0, toshio: 100, montoMensual: 39 },
    seguro: { nombre: 'Seguro', javier: 0, toshio: 100, montoMensual: 77.18 },
    internet: { nombre: 'Internet', javier: 50, toshio: 50, montoMensual: 34 },
    perros: { nombre: 'Perros', javier: 50, toshio: 50, montoMensual: 54.03 }
};

const TOTALES_PERSONA = {
    javier: 374.88,
    toshio: 491.06
};

// Estado inicial
let estado = {
    montoInicial: 0,
    saldoActual: 0,
    depositos: { javier: 0, toshio: 0 },
    gastos: { total: 0, porConcepto: {} },
    ahorro: { javier: 0, toshio: 0 },
    prestamos: { javier: [], toshio: [], otros: [] },
    conceptos: {},
    pendientesMesesAnteriores: [],
    historialCierres: [],
    movimientos: []
};

// Funciones de comunicación con Google Sheets
async function callGoogleScript(action, data = {}) {
    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: action,
                data: JSON.stringify(data)
            })
        });
        
        // Como no-cors no permite leer la respuesta directamente,
        // usamos un callback o almacenamos localmente
        console.log('Solicitud enviada:', action);
        return { success: true };
    } catch (error) {
        console.error('Error:', error);
        return { success: false, error: error.message };
    }
}

// Cargar datos desde el servidor
async function cargarDatos() {
    try {
        // Intentar cargar desde localStorage primero (caché local)
        const localData = localStorage.getItem('controlGastosBackup');
        if (localData) {
            const parsedData = JSON.parse(localData);
            if (parsedData && Object.keys(parsedData).length > 0) {
                estado = parsedData;
                actualizarUI();
            }
        }
        
        // Intentar sincronizar con Google Sheets
        const response = await fetch(SCRIPT_URL + '?action=getData');
        const data = await response.json();
        
        if (data.success && data.data) {
            estado = data.data;
            localStorage.setItem('controlGastosBackup', JSON.stringify(estado));
            actualizarUI();
        }
    } catch (error) {
        console.error('Error al cargar datos:', error);
    }
}

// Guardar datos en el servidor
async function guardarDatos() {
    // Guardar localmente primero
    localStorage.setItem('controlGastosBackup', JSON.stringify(estado));
    
    // Intentar guardar en Google Sheets
    try {
        await callGoogleScript('saveData', estado);
    } catch (error) {
        console.error('Error al guardar en Google Sheets:', error);
    }
}

// Función de login
function login() {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    
    if (USUARIOS[user] && USUARIOS[user] === pass) {
        localStorage.setItem('loggedUser', user);
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        cargarDatos();
    } else {
        document.getElementById('loginError').innerText = 'Usuario o contraseña incorrectos';
    }
}

function logout() {
    localStorage.removeItem('loggedUser');
    document.getElementById('loginContainer').style.display = 'block';
    document.getElementById('mainContent').style.display = 'none';
}

// Recalcular estado desde movimientos
function recalcularEstado() {
    const montoInicialGuardado = estado.montoInicial;
    const historialGuardado = estado.historialCierres;
    const movimientos = estado.movimientos;
    
    // Reiniciar estado
    estado = {
        montoInicial: montoInicialGuardado,
        saldoActual: montoInicialGuardado,
        depositos: { javier: 0, toshio: 0 },
        gastos: { total: 0, porConcepto: {} },
        ahorro: { javier: 0, toshio: 0 },
        prestamos: { javier: [], toshio: [], otros: [] },
        conceptos: {},
        pendientesMesesAnteriores: [],
        historialCierres: historialGuardado,
        movimientos: movimientos
    };
    
    // Inicializar conceptos
    Object.keys(GASTOS_FIJOS).forEach(concepto => {
        estado.conceptos[concepto] = { pagado: 0, diferencia: 0 };
    });
    
    // Aplicar movimientos
    for (const mov of estado.movimientos) {
        switch (mov.tipo) {
            case 'DEPÓSITO':
                const persona = mov.concepto === 'Javier' ? 'javier' : 'toshio';
                estado.depositos[persona] += mov.monto;
                estado.saldoActual += mov.monto;
                const debePagar = TOTALES_PERSONA[persona];
                if (estado.depositos[persona] > debePagar) {
                    const excedente = estado.depositos[persona] - debePagar;
                    estado.ahorro[persona] += excedente;
                    estado.depositos[persona] = debePagar;
                }
                break;
            case 'PAGO':
                const concepto = Object.keys(GASTOS_FIJOS).find(key => GASTOS_FIJOS[key].nombre === mov.concepto);
                if (concepto) {
                    const gasto = GASTOS_FIJOS[concepto];
                    estado.conceptos[concepto].pagado += mov.monto;
                    estado.conceptos[concepto].diferencia = estado.conceptos[concepto].pagado - gasto.montoMensual;
                    estado.gastos.total += mov.monto;
                    estado.saldoActual -= mov.monto;
                }
                break;
            case 'INTERÉS BANCARIO':
            case 'GASTO BANCARIO':
                if (mov.tipo === 'INTERÉS BANCARIO') {
                    estado.saldoActual += mov.monto;
                } else {
                    estado.saldoActual -= mov.monto;
                }
                break;
            case 'PRÉSTAMO':
                let tipoPrestamo = 'otros';
                if (mov.concepto.includes('Javier')) tipoPrestamo = 'javier';
                else if (mov.concepto.includes('Toshio')) tipoPrestamo = 'toshio';
                const nombre = mov.detalle || 'Desconocido';
                estado.prestamos[tipoPrestamo].push({
                    fecha: mov.fecha,
                    monto: mov.monto,
                    nombre: nombre
                });
                estado.saldoActual -= mov.monto;
                break;
            case 'RETIRO AHORRO':
                if (mov.concepto.includes('Javier')) {
                    estado.ahorro.javier -= mov.monto;
                    estado.saldoActual += mov.monto;
                } else if (mov.concepto.includes('Toshio')) {
                    estado.ahorro.toshio -= mov.monto;
                    estado.saldoActual += mov.monto;
                }
                break;
            case 'PAGO PENDIENTE':
                const conceptoPend = Object.keys(GASTOS_FIJOS).find(key => GASTOS_FIJOS[key].nombre === mov.concepto);
                if (conceptoPend) {
                    const gasto = GASTOS_FIJOS[conceptoPend];
                    estado.conceptos[conceptoPend].pagado += mov.monto;
                    estado.conceptos[conceptoPend].diferencia = estado.conceptos[conceptoPend].pagado - gasto.montoMensual;
                    estado.gastos.total += mov.monto;
                    estado.saldoActual -= mov.monto;
                }
                break;
        }
    }
}

// Funciones de interfaz
function seleccionarTipo(tipo, boton) {
    document.querySelectorAll('.tipo-btn').forEach(btn => btn.classList.remove('activo'));
    boton.classList.add('activo');
    
    document.getElementById('camposDeposito').classList.add('oculto');
    document.getElementById('camposPago').classList.add('oculto');
    document.getElementById('camposBanco').classList.add('oculto');
    document.getElementById('camposPrestamo').classList.add('oculto');
    
    if (tipo === 'deposito') document.getElementById('camposDeposito').classList.remove('oculto');
    else if (tipo === 'pago') document.getElementById('camposPago').classList.remove('oculto');
    else if (tipo === 'banco') document.getElementById('camposBanco').classList.remove('oculto');
    else if (tipo === 'prestamo') document.getElementById('camposPrestamo').classList.remove('oculto');
}

function togglePrestamoField() {
    const tipo = document.getElementById('tipoPrestamo').value;
    document.getElementById('nombrePrestamoField').style.display = tipo === 'otros' ? 'block' : 'none';
}

// Funciones de negocio
async function establecerMontoInicial() {
    if (estado.montoInicial > 0) {
        alert('El monto inicial ya fue establecido y no se puede modificar');
        return;
    }
    
    const monto = parseFloat(document.getElementById('montoInicial').value);
    if (isNaN(monto) || monto <= 0) {
        alert('Ingrese un monto válido mayor a 0');
        return;
    }
    
    estado.montoInicial = monto;
    estado.saldoActual = monto;
    document.getElementById('btnEstablecerMonto').disabled = true;
    document.getElementById('montoInicial').disabled = true;
    
    await guardarDatos();
    actualizarUI();
    alert('Saldo inicial establecido correctamente');
}

async function registrarDeposito() {
    if (estado.montoInicial === 0) { alert('Primero establezca el saldo inicial'); return; }
    
    const fecha = document.getElementById('fechaDeposito').value;
    const persona = document.getElementById('personaDeposito').value;
    const quincena = document.getElementById('quincenaDeposito').value;
    const monto = parseFloat(document.getElementById('montoDeposito').value);
    
    if (!fecha || isNaN(monto) || monto <= 0) { alert('Complete todos los campos'); return; }
    
    estado.depositos[persona] += monto;
    estado.saldoActual += monto;
    const debePagar = TOTALES_PERSONA[persona];
    
    if (estado.depositos[persona] > debePagar) {
        const excedente = estado.depositos[persona] - debePagar;
        estado.ahorro[persona] += excedente;
        estado.depositos[persona] = debePagar;
    }
    
    estado.movimientos.push({
        id: Date.now() + Math.random().toString(36).substr(2, 8),
        fecha, tipo: 'DEPÓSITO', concepto: persona === 'javier' ? 'Javier' : 'Toshio',
        detalle: `${quincena}ra Quincena`, monto,
        javier: persona === 'javier' ? monto : 0,
        toshio: persona === 'toshio' ? monto : 0
    });
    
    await guardarDatos();
    actualizarUI();
    document.getElementById('montoDeposito').value = '';
    alert('Depósito registrado');
}

async function registrarPago() {
    if (estado.montoInicial === 0) { alert('Primero establezca el saldo inicial'); return; }
    
    const fecha = document.getElementById('fechaPago').value;
    const concepto = document.getElementById('conceptoPago').value;
    const monto = parseFloat(document.getElementById('montoPago').value);
    
    if (!fecha || isNaN(monto) || monto <= 0) { alert('Complete todos los campos'); return; }
    
    const gasto = GASTOS_FIJOS[concepto];
    estado.conceptos[concepto].pagado += monto;
    estado.conceptos[concepto].diferencia = estado.conceptos[concepto].pagado - gasto.montoMensual;
    estado.gastos.total += monto;
    estado.saldoActual -= monto;
    
    estado.movimientos.push({
        id: Date.now() + Math.random().toString(36).substr(2, 8),
        fecha, tipo: 'PAGO', concepto: gasto.nombre, detalle: 'Mensual', monto,
        javier: (gasto.javier / 100) * monto,
        toshio: (gasto.toshio / 100) * monto
    });
    
    await guardarDatos();
    actualizarUI();
    document.getElementById('montoPago').value = '';
    alert('Pago registrado');
}

async function registrarBanco() {
    if (estado.montoInicial === 0) { alert('Primero establezca el saldo inicial'); return; }
    
    const fecha = document.getElementById('fechaBanco').value;
    const tipo = document.getElementById('tipoBanco').value;
    const monto = parseFloat(document.getElementById('montoBanco').value);
    
    if (!fecha || isNaN(monto) || monto <= 0) { alert('Complete todos los campos'); return; }
    
    let tipoMovimiento, concepto, detalle;
    
    if (tipo === 'interes') {
        estado.saldoActual += monto;
        tipoMovimiento = 'INTERÉS BANCARIO';
        concepto = 'Interés';
        detalle = '➕ Aumenta saldo';
    } else {
        estado.saldoActual -= monto;
        tipoMovimiento = 'GASTO BANCARIO';
        concepto = 'Gasto';
        detalle = '➖ Disminuye saldo';
    }
    
    estado.movimientos.push({
        id: Date.now() + Math.random().toString(36).substr(2, 8),
        fecha,
        tipo: tipoMovimiento,
        concepto,
        detalle,
        monto,
        javier: 0,
        toshio: 0
    });
    
    await guardarDatos();
    actualizarUI();
    document.getElementById('montoBanco').value = '';
    alert('Movimiento bancario registrado');
}

async function registrarPrestamo() {
    if (estado.montoInicial === 0) { alert('Primero establezca el saldo inicial'); return; }
    
    const fecha = document.getElementById('fechaPrestamo').value;
    const tipo = document.getElementById('tipoPrestamo').value;
    const monto = parseFloat(document.getElementById('montoPrestamo').value);
    const nombre = tipo === 'otros' ? document.getElementById('nombrePrestamo').value : '';
    
    if (!fecha || isNaN(monto) || monto <= 0) { alert('Complete los campos'); return; }
    if (tipo === 'otros' && !nombre) { alert('Ingrese el nombre'); return; }
    
    const prestamoInfo = { fecha, monto, nombre: nombre || (tipo === 'javier' ? 'Javier' : 'Toshio') };
    
    if (tipo === 'javier') estado.prestamos.javier.push(prestamoInfo);
    else if (tipo === 'toshio') estado.prestamos.toshio.push(prestamoInfo);
    else estado.prestamos.otros.push(prestamoInfo);
    
    estado.saldoActual -= monto;
    
    estado.movimientos.push({
        id: Date.now() + Math.random().toString(36).substr(2, 8),
        fecha, tipo: 'PRÉSTAMO', concepto: `Préstamo a ${prestamoInfo.nombre}`,
        detalle: tipo === 'otros' ? nombre : `a ${tipo}`, monto,
        javier: tipo === 'javier' ? monto : 0,
        toshio: tipo === 'toshio' ? monto : 0
    });
    
    await guardarDatos();
    actualizarUI();
    document.getElementById('montoPrestamo').value = '';
    document.getElementById('nombrePrestamo').value = '';
    document.getElementById('nombrePrestamoField').style.display = 'none';
    alert('Préstamo registrado');
}

async function pagarPrestamo(tipo, index) {
    let prestamo;
    
    if (tipo === 'javier') {
        prestamo = estado.prestamos.javier[index];
        estado.prestamos.javier.splice(index, 1);
    } else if (tipo === 'toshio') {
        prestamo = estado.prestamos.toshio[index];
        estado.prestamos.toshio.splice(index, 1);
    } else {
        prestamo = estado.prestamos.otros[index];
        estado.prestamos.otros.splice(index, 1);
    }
    
    estado.saldoActual += prestamo.monto;
    
    estado.movimientos.push({
        id: Date.now() + Math.random().toString(36).substr(2, 8),
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'PAGO PRÉSTAMO',
        concepto: `Devolución de ${prestamo.nombre}`,
        detalle: 'Pago de préstamo',
        monto: prestamo.monto,
        javier: tipo === 'javier' ? prestamo.monto : 0,
        toshio: tipo === 'toshio' ? prestamo.monto : 0
    });
    
    await guardarDatos();
    actualizarUI();
    alert('Pago de préstamo registrado');
}

async function pagarPendiente(concepto) {
    const gasto = GASTOS_FIJOS[concepto];
    const pendiente = estado.pendientesMesesAnteriores.find(p => p.concepto === concepto);
    
    if (!pendiente) return;
    
    const montoPagar = pendiente.monto;
    estado.conceptos[concepto].pagado += montoPagar;
    estado.conceptos[concepto].diferencia = estado.conceptos[concepto].pagado - gasto.montoMensual;
    estado.gastos.total += montoPagar;
    estado.saldoActual -= montoPagar;
    
    estado.pendientesMesesAnteriores = estado.pendientesMesesAnteriores.filter(p => p.concepto !== concepto);
    
    estado.movimientos.push({
        id: Date.now() + Math.random().toString(36).substr(2, 8),
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'PAGO PENDIENTE',
        concepto: gasto.nombre,
        detalle: 'Mes anterior',
        monto: montoPagar,
        javier: (gasto.javier / 100) * montoPagar,
        toshio: (gasto.toshio / 100) * montoPagar
    });
    
    await guardarDatos();
    actualizarUI();
    alert(`Pago de ${gasto.nombre} de mes anterior realizado`);
}

async function retirarAhorroIndividual(persona) {
    let monto, input;
    
    if (persona === 'javier') {
        input = document.getElementById('retiroJavier');
        monto = parseFloat(input.value);
        if (isNaN(monto) || monto <= 0) { alert('Ingrese monto válido'); return; }
        if (monto > estado.ahorro.javier) { alert(`Javier solo tiene $${estado.ahorro.javier.toFixed(2)} de ahorro`); return; }
        estado.ahorro.javier -= monto;
        estado.saldoActual += monto;
    } else {
        input = document.getElementById('retiroToshio');
        monto = parseFloat(input.value);
        if (isNaN(monto) || monto <= 0) { alert('Ingrese monto válido'); return; }
        if (monto > estado.ahorro.toshio) { alert(`Toshio solo tiene $${estado.ahorro.toshio.toFixed(2)} de ahorro`); return; }
        estado.ahorro.toshio -= monto;
        estado.saldoActual += monto;
    }
    
    estado.movimientos.push({
        id: Date.now() + Math.random().toString(36).substr(2, 8),
        fecha: new Date().toISOString().split('T')[0],
        tipo: 'RETIRO AHORRO',
        concepto: `Retiro ahorro ${persona}`,
        detalle: '',
        monto,
        javier: persona === 'javier' ? monto : 0,
        toshio: persona === 'toshio' ? monto : 0
    });
    
    await guardarDatos();
    actualizarUI();
    input.value = '';
    alert(`Retiro de ahorro de ${persona} realizado`);
}

async function cerrarMes() {
    const mes = prompt("Ingrese el mes que está cerrando (ejemplo: 1 para Enero, 2 para Febrero, etc.):");
    if (!mes) return;
    
    const año = prompt("Ingrese el año (ejemplo: 2025):");
    if (!año) return;
    
    const mesNombre = new Date(año, mes-1, 1).toLocaleString('es', { month: 'long' });
    
    if (!confirm(`¿Cerrar mes de ${mesNombre} ${año}?`)) return;
    
    const totalDepositos = estado.depositos.javier + estado.depositos.toshio;
    const totalGastos = estado.gastos.total;
    const totalAhorros = estado.ahorro.javier + estado.ahorro.toshio;
    const totalPrestamosJavier = estado.prestamos.javier.reduce((s, p) => s + p.monto, 0);
    const totalPrestamosToshio = estado.prestamos.toshio.reduce((s, p) => s + p.monto, 0);
    const totalPrestamosOtros = estado.prestamos.otros.reduce((s, p) => s + p.monto, 0);
    const totalPrestamos = totalPrestamosJavier + totalPrestamosToshio + totalPrestamosOtros;
    
    const conceptosConExcedente = [], conceptosConFaltante = [];
    Object.entries(estado.conceptos).forEach(([key, value]) => {
        if (value.diferencia > 0) conceptosConExcedente.push(`${GASTOS_FIJOS[key].nombre}: +$${value.diferencia.toFixed(2)}`);
        else if (value.diferencia < 0) conceptosConFaltante.push(`${GASTOS_FIJOS[key].nombre}: -$${Math.abs(value.diferencia).toFixed(2)}`);
    });
    
    const noPagados = [];
    Object.entries(estado.conceptos).forEach(([key, value]) => {
        if (value.pagado === 0) {
            noPagados.push({ concepto: key, nombre: GASTOS_FIJOS[key].nombre, monto: GASTOS_FIJOS[key].montoMensual });
        }
    });
    
    estado.pendientesMesesAnteriores = noPagados;
    
    const resumenHistorial = {
        fecha: new Date().toISOString(),
        mes: mesNombre,
        año,
        totalDepositos,
        totalGastos,
        totalAhorros,
        totalPrestamos,
        saldoFinal: estado.saldoActual,
        detallesConceptos: Object.entries(estado.conceptos).map(([key, val]) => ({
            concepto: GASTOS_FIJOS[key].nombre,
            pagado: val.pagado,
            diferencia: val.diferencia
        }))
    };
    
    estado.historialCierres.push(resumenHistorial);
    
    // Reiniciar valores del mes
    estado.depositos.javier = 0;
    estado.depositos.toshio = 0;
    estado.gastos.total = 0;
    Object.keys(estado.conceptos).forEach(concepto => {
        estado.conceptos[concepto].pagado = 0;
        estado.conceptos[concepto].diferencia = 0;
    });
    estado.montoInicial = estado.saldoActual;
    
    await guardarDatos();
    actualizarUI();
    
    alert(`Mes ${mesNombre} ${año} cerrado exitosamente`);
}

function actualizarUI() {
    const totalDepositos = estado.depositos.javier + estado.depositos.toshio;
    const totalAhorros = estado.ahorro.javier + estado.ahorro.toshio;
    const totalPrestamosJavier = estado.prestamos.javier.reduce((s, p) => s + p.monto, 0);
    const totalPrestamosToshio = estado.prestamos.toshio.reduce((s, p) => s + p.monto, 0);
    const totalPrestamosOtros = estado.prestamos.otros.reduce((s, p) => s + p.monto, 0);
    const disponibleGastos = estado.saldoActual - totalAhorros;
    
    // Actualizar saldos
    document.getElementById('montoFijoDisplay').textContent = `$${estado.montoInicial.toFixed(2)}`;
    document.getElementById('saldoJavier').textContent = `$${(estado.depositos.javier - TOTALES_PERSONA.javier + estado.ahorro.javier).toFixed(2)}`;
    document.getElementById('depositadoJavier').textContent = `$${estado.depositos.javier.toFixed(2)}`;
    document.getElementById('ahorroJavierCard').textContent = `$${estado.ahorro.javier.toFixed(2)}`;
    document.getElementById('prestamosJavierCard').textContent = `$${totalPrestamosJavier.toFixed(2)}`;
    document.getElementById('saldoToshio').textContent = `$${(estado.depositos.toshio - TOTALES_PERSONA.toshio + estado.ahorro.toshio).toFixed(2)}`;
    document.getElementById('depositadoToshio').textContent = `$${estado.depositos.toshio.toFixed(2)}`;
    document.getElementById('ahorroToshioCard').textContent = `$${estado.ahorro.toshio.toFixed(2)}`;
    document.getElementById('prestamosToshioCard').textContent = `$${totalPrestamosToshio.toFixed(2)}`;
    document.getElementById('saldoConjunto').textContent = `$${estado.saldoActual.toFixed(2)}`;
    document.getElementById('saldoBanco').textContent = `$${estado.saldoActual.toFixed(2)}`;
    document.getElementById('disponibleGastos').textContent = `$${disponibleGastos.toFixed(2)}`;
    document.getElementById('totalGastos').textContent = `$${estado.gastos.total.toFixed(2)}`;
    document.getElementById('ahorroTotal').textContent = `$${totalAhorros.toFixed(2)}`;
    document.getElementById('ahorroJavierTotal').textContent = `$${estado.ahorro.javier.toFixed(2)}`;
    document.getElementById('ahorroToshioTotal').textContent = `$${estado.ahorro.toshio.toFixed(2)}`;
    
    document.getElementById('ahorroJavierIndividual').textContent = `$${estado.ahorro.javier.toFixed(2)}`;
    document.getElementById('ahorroToshioIndividual').textContent = `$${estado.ahorro.toshio.toFixed(2)}`;
    
    // Actualizar préstamos
    document.getElementById('prestamosJavierTotal').textContent = `$${totalPrestamosJavier.toFixed(2)}`;
    document.getElementById('prestamosToshioTotal').textContent = `$${totalPrestamosToshio.toFixed(2)}`;
    document.getElementById('prestamosOtrosTotal').textContent = `$${totalPrestamosOtros.toFixed(2)}`;
    
    document.getElementById('prestamosJavierLista').innerHTML = estado.prestamos.javier.length 
        ? estado.prestamos.javier.map((p, i) => `<div class="prestamo-item"><span>${p.fecha} - $${p.monto.toFixed(2)}</span><button class="btn-pagar-prestamo" onclick="pagarPrestamo('javier', ${i})">Pagar</button></div>`).join('')
        : '<div class="prestamo-item">Sin préstamos</div>';
    
    document.getElementById('prestamosToshioLista').innerHTML = estado.prestamos.toshio.length
        ? estado.prestamos.toshio.map((p, i) => `<div class="prestamo-item"><span>${p.fecha} - $${p.monto.toFixed(2)}</span><button class="btn-pagar-prestamo" onclick="pagarPrestamo('toshio', ${i})">Pagar</button></div>`).join('')
        : '<div class="prestamo-item">Sin préstamos</div>';
    
    document.getElementById('prestamosOtrosLista').innerHTML = estado.prestamos.otros.length
        ? estado.prestamos.otros.map((p, i) => `<div class="prestamo-item"><span>${p.nombre} - ${p.fecha} - $${p.monto.toFixed(2)}</span><button class="btn-pagar-prestamo" onclick="pagarPrestamo('otros', ${i})">Pagar</button></div>`).join('')
        : '<div class="prestamo-item">Sin préstamos</div>';
    
    // Gráfica
    const maxValor = Math.max(totalDepositos, estado.gastos.total, totalAhorros) || 1;
    const alturaMaxima = 150;
    document.getElementById('barraDepositos').style.height = (totalDepositos / maxValor) * alturaMaxima + 'px';
    document.getElementById('barraGastos').style.height = (estado.gastos.total / maxValor) * alturaMaxima + 'px';
    document.getElementById('barraAhorros').style.height = (totalAhorros / maxValor) * alturaMaxima + 'px';
    document.getElementById('totalDepositos').textContent = `$${totalDepositos.toFixed(2)}`;
    document.getElementById('totalGastosGrafica').textContent = `$${estado.gastos.total.toFixed(2)}`;
    document.getElementById('totalAhorrosGrafica').textContent = `$${totalAhorros.toFixed(2)}`;
    
    // Pagos pendientes
    const pendientesContainer = document.getElementById('pendientesContainer');
    if (estado.pendientesMesesAnteriores.length > 0) {
        document.getElementById('pagosPendientesSection').style.display = 'block';
        pendientesContainer.innerHTML = estado.pendientesMesesAnteriores.map(p => `
            <div class="pendiente-card">
                <div class="pendiente-info">
                    <h4>${p.nombre}</h4>
                    <div class="monto">$${p.monto.toFixed(2)}</div>
                    <div>Pendiente de mes anterior</div>
                </div>
                <button class="btn-pagar-pendiente" onclick="pagarPendiente('${p.concepto}')">Pagar</button>
            </div>
        `).join('');
    } else {
        document.getElementById('pagosPendientesSection').style.display = 'none';
    }
    
    // Historial
    const historialContainer = document.getElementById('historialContainer');
    historialContainer.innerHTML = estado.historialCierres.slice().reverse().map(h => `
        <div class="historial-card">
            <h4>${h.mes} ${h.año}</h4>
            <div class="historial-detalle">💰 Depósitos: $${h.totalDepositos.toFixed(2)}</div>
            <div class="historial-detalle">💸 Gastos: $${h.totalGastos.toFixed(2)}</div>
            <div class="historial-detalle">💰 Ahorros: $${h.totalAhorros.toFixed(2)}</div>
            <div class="historial-detalle">💰 Préstamos: $${h.totalPrestamos.toFixed(2)}</div>
            <div class="historial-detalle">🏦 Saldo final: $${h.saldoFinal.toFixed(2)}</div>
            <details>
                <summary>Ver conceptos</summary>
                ${h.detallesConceptos.map(d => `<div>${d.concepto}: pagado $${d.pagado.toFixed(2)} (${d.diferencia > 0 ? '+' : ''}${d.diferencia.toFixed(2)})</div>`).join('')}
            </details>
        </div>
    `).join('') || '<p>No hay cierres anteriores</p>';
    
    // Resumen de conceptos
    const conceptosResumen = document.getElementById('conceptosResumen');
    conceptosResumen.innerHTML = Object.entries(GASTOS_FIJOS).map(([key, gasto]) => {
        const concepto = estado.conceptos[key] || { pagado: 0, diferencia: 0 };
        const pagado = concepto.pagado || 0;
        const clase = pagado >= gasto.montoMensual ? 'pagado-completo' : (pagado > 0 ? 'con-excedente' : 'faltante');
        const porcentaje = totalDepositos > 0 ? (pagado / totalDepositos) * 100 : 0;
        const alerta = porcentaje > 20 ? '<span class="alerta-20">⚠️ >20%</span>' : '';
        return `
            <div class="concepto-card ${clase}">
                <h4>${gasto.nombre} ${alerta}</h4>
                <div class="concepto-detalle"><span>Debe ser:</span><span>$${gasto.montoMensual.toFixed(2)}</span></div>
                <div class="concepto-detalle"><span>Pagado:</span><span>$${pagado.toFixed(2)}</span></div>
                <div class="concepto-detalle"><span>% del total:</span><span>${porcentaje.toFixed(1)}%</span></div>
                <div class="concepto-detalle ${concepto.diferencia > 0 ? 'text-success' : concepto.diferencia < 0 ? 'text-danger' : ''}">
                    <span>Diferencia:</span><span>$${concepto.diferencia.toFixed(2)}</span>
                </div>
            </div>
        `;
    }).join('');
    
    // Resumen global
    const resumenGlobal = document.getElementById('resumenGlobal');
    resumenGlobal.innerHTML = `
        <div class="resumen-item"><span>💰 Total Depositado:</span><span>$${totalDepositos.toFixed(2)}</span></div>
        <div class="resumen-item"><span>💸 Total Gastado:</span><span>$${estado.gastos.total.toFixed(2)}</span></div>
        <div class="resumen-item"><span>💰 Total Ahorrado:</span><span>$${totalAhorros.toFixed(2)}</span></div>
        <div class="resumen-item"><span>💰 Total Préstamos:</span><span>$${(totalPrestamosJavier + totalPrestamosToshio + totalPrestamosOtros).toFixed(2)}</span></div>
        <div class="resumen-item"><span>📊 Diferencia:</span><span class="${totalDepositos - estado.gastos.total >= 0 ? 'text-success' : 'text-danger'}">$${(totalDepositos - estado.gastos.total).toFixed(2)}</span></div>
        <div class="resumen-total"><span>💰 Saldo Actual:</span><span>$${estado.saldoActual.toFixed(2)}</span></div>
    `;
    
    // Tabla de movimientos
    const tbody = document.getElementById('movimientosBody');
    tbody.innerHTML = '';
    estado.movimientos.slice().reverse().forEach(m => {
        const row = tbody.insertRow();
        row.innerHTML = `
            <td>${m.fecha}</td>
            <td>${m.tipo}</td>
            <td>${m.concepto}</td>
            <td>${m.detalle || '-'}</td>
            <td>$${m.monto.toFixed(2)}</td>
            <td>$${m.javier.toFixed(2)}</td>
            <td>$${m.toshio.toFixed(2)}</td>
            <td><button class="btn-pagar-pendiente" onclick="solicitarReversion('${m.id}')">↩️</button></td>
        `;
    });
}

function solicitarReversion(id) {
    const codigo = prompt('Ingrese el código de autorización:');
    if (codigo !== 'jato') {
        alert('Código incorrecto.');
        return;
    }
    
    const motivo = prompt('Seleccione motivo (1 = duplicado, 2 = mal registrado):');
    let motivoTexto = '';
    if (motivo === '1') motivoTexto = 'duplicado';
    else if (motivo === '2') motivoTexto = 'mal registrado';
    else {
        alert('Motivo no válido.');
        return;
    }
    
    reversarMovimiento(id, motivoTexto);
}

async function reversarMovimiento(id, motivo) {
    const index = estado.movimientos.findIndex(m => m.id === id);
    if (index === -1) {
        alert('Movimiento no encontrado.');
        return;
    }
    
    const mov = estado.movimientos[index];
    
    if (!confirm(`¿Reversar movimiento del ${mov.fecha} (${mov.tipo} - ${mov.concepto}) por motivo: ${motivo}?`)) return;
    
    estado.movimientos.splice(index, 1);
    recalcularEstado();
    
    await guardarDatos();
    actualizarUI();
    alert('Movimiento reversado correctamente.');
}

// Inicialización
window.onload = function() {
    if (localStorage.getItem('loggedUser')) {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
        cargarDatos();
    } else {
        document.getElementById('loginContainer').style.display = 'block';
        document.getElementById('mainContent').style.display = 'none';
    }
    
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fechaDeposito').value = hoy;
    document.getElementById('fechaPago').value = hoy;
    document.getElementById('fechaBanco').value = hoy;
    document.getElementById('fechaPrestamo').value = hoy;
};
