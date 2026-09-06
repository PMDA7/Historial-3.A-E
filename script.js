/* =========================================================
   BITÁCORA ACADÉMICA - FRONTEND V2
   Navegación + búsqueda + pendientes + filtros + caché
========================================================= */


/* =========================================================
   CONFIGURACIÓN
========================================================= */

const API_URL =
    "https://script.google.com/macros/s/AKfycbzhHpzlGjlmA6lwHCjJVcsal0vjPhkqgzFCPs2EhOsnIDC5VLRm5gxL3QMdjb-xhYjL/exec";

const CACHE_KEY = "bitacora_academica_cache_v2";
const CACHE_DURATION = 5 * 60 * 1000;
const WELCOME_SEEN_KEY = "bitacora_academica_welcome_seen_v1";


/* =========================================================
   DOM
========================================================= */

const subjectsContainer =
    document.getElementById("subjectsContainer");

const pendingContainer =
    document.getElementById("pendingContainer");

const searchResultsContainer =
    document.getElementById("searchResultsContainer");

const globalSearch =
    document.getElementById("globalSearch");

const clearSearchButton =
    document.getElementById("clearSearchButton");

const pendingSummary =
    document.getElementById("pendingSummary");

const totalMaterias =
    document.getElementById("totalMaterias");

const totalPendientes =
    document.getElementById("totalPendientes");

const totalRegistros =
    document.getElementById("totalRegistros");

const lastUpdateText =
    document.getElementById("lastUpdateText");

const lastUpdateExact =
    document.getElementById("lastUpdateExact");

const refreshDataButton =
    document.getElementById("refreshDataButton");

const dashboardView =
    document.getElementById("dashboardView");

const subjectView =
    document.getElementById("subjectView");

const backButton =
    document.getElementById("backButton");

const breadcrumbDashboard =
    document.getElementById("breadcrumbDashboard");

const breadcrumbSubject =
    document.getElementById("breadcrumbSubject");

const subjectTitle =
    document.getElementById("subjectTitle");

const subjectSubtitle =
    document.getElementById("subjectSubtitle");

const subjectTotal =
    document.getElementById("subjectTotal");

const subjectActivities =
    document.getElementById("subjectActivities");

const subjectTasks =
    document.getElementById("subjectTasks");

const historyContainer =
    document.getElementById("historyContainer");

const historySearch =
    document.getElementById("historySearch");

const welcomeModal =
    document.getElementById("welcomeModal");

const closeWelcomeModal =
    document.getElementById("closeWelcomeModal");

const welcomeModalButton =
    document.getElementById("welcomeModalButton");

const filterButtons =
    document.querySelectorAll(".filter-button");

const themeToggle =
    document.getElementById("themeToggle");

const THEME_KEY = "bitacora_academica_theme_v1";


/* =========================================================
   ESTADO GLOBAL
========================================================= */

const estadoApp = {

    materias: [],

    registros: [],

    pendientes: [],

    materiaActual: null,

    registrosMateriaActual: [],

    filtroActual: "todo",

    busquedaGlobal: "",

    busquedaHistorial: "",

    registroObjetivo: null,

    cargando: false,

    usandoCache: false,

    ultimoError: null,

    actualizandoDatos: false,

    ultimaActualizacion: null,

    actualizacionFallida: false

};


/* =========================================================
   TEMA / MODO OSCURO
========================================================= */

function obtenerTemaPreferido() {
    try {
        const guardado = localStorage.getItem(THEME_KEY);

        if (guardado === "dark" || guardado === "light") {
            return guardado;
        }
    } catch (error) {
        console.warn("No se pudo leer la preferencia de tema:", error);
    }

    /* Primera visita: el tema claro es siempre el predeterminado.
       El modo oscuro solo se activa cuando el usuario lo elige. */
    return "light";
}

function aplicarTema(tema, guardar = true) {
    const esOscuro = tema === "dark";

    document.body.classList.toggle("dark-mode", esOscuro);

    if (themeToggle) {
        themeToggle.setAttribute("aria-pressed", String(esOscuro));
        themeToggle.setAttribute(
            "aria-label",
            esOscuro ? "Activar modo claro" : "Activar modo oscuro"
        );
        themeToggle.setAttribute(
            "title",
            esOscuro ? "Activar modo claro" : "Activar modo oscuro"
        );

        const icon = themeToggle.querySelector(".theme-toggle-icon");
        const text = themeToggle.querySelector(".theme-toggle-text");

        if (icon) {
            icon.textContent = esOscuro ? "☀" : "☾";
        }

        if (text) {
            text.textContent = esOscuro ? "Modo claro" : "Modo oscuro";
        }
    }

    if (guardar) {
        try {
            localStorage.setItem(THEME_KEY, esOscuro ? "dark" : "light");
        } catch (error) {
            console.warn("No se pudo guardar la preferencia de tema:", error);
        }
    }
}

function alternarTema() {
    const esOscuro = document.body.classList.contains("dark-mode");
    aplicarTema(esOscuro ? "light" : "dark");
}

aplicarTema(obtenerTemaPreferido(), false);

if (themeToggle) {
    themeToggle.addEventListener("click", alternarTema);
}


/* =========================================================
   INICIO
========================================================= */

async function iniciarAplicacion() {

    if (estadoApp.cargando) {
        return;
    }

    estadoApp.cargando = true;

    mostrarCarga();

    const cache = obtenerCache();

    if (cache) {

        cargarEstadoDesdeDatos(
            cache.materias,
            cache.registros
        );

        estadoApp.usandoCache = true;
        estadoApp.ultimaActualizacion = cache.timestamp;
        estadoApp.actualizacionFallida = false;
        actualizarIndicadorActualizacion();

        renderizarDashboard();

        estadoApp.cargando = false;

        /*
         * Se actualiza en segundo plano para que
         * las cargas posteriores sean rápidas sin
         * dejar los datos permanentemente antiguos.
         */

        actualizarDatosEnSegundoPlano();

        return;
    }


    try {

        const datos =
            await descargarDatos();

        cargarEstadoDesdeDatos(
            datos.materias,
            datos.registros
        );

        guardarCache(
            datos.materias,
            datos.registros
        );

        estadoApp.usandoCache = false;
        estadoApp.ultimaActualizacion = Date.now();
        estadoApp.actualizacionFallida = false;
        actualizarIndicadorActualizacion();

        renderizarDashboard();

    } catch (error) {

        console.error(
            "Error al iniciar la aplicación:",
            error
        );

        estadoApp.ultimoError = error;
        estadoApp.actualizacionFallida = true;
        actualizarIndicadorActualizacion();

        mostrarError();

    } finally {

        estadoApp.cargando = false;

    }
}


/* =========================================================
   DESCARGA DE DATOS
========================================================= */

async function descargarDatos() {

    const [
        materiasResponse,
        registrosResponse
    ] = await Promise.all([

        obtenerDatos("materias"),

        obtenerDatos("data")

    ]);


    const materias =
        Array.isArray(materiasResponse.data)
            ? materiasResponse.data
            : [];


    const registros =
        Array.isArray(registrosResponse.data)
            ? registrosResponse.data
            : [];


    return {
        materias,
        registros
    };
}


/* =========================================================
   ACTUALIZACIÓN EN SEGUNDO PLANO
========================================================= */

async function actualizarDatosEnSegundoPlano() {

    try {

        const datos =
            await descargarDatos();

        cargarEstadoDesdeDatos(
            datos.materias,
            datos.registros
        );

        guardarCache(
            datos.materias,
            datos.registros
        );

        estadoApp.usandoCache = false;
        estadoApp.ultimaActualizacion = Date.now();
        estadoApp.actualizacionFallida = false;
        actualizarIndicadorActualizacion();


        /*
         * Si el usuario sigue en dashboard,
         * actualizamos visualmente.
         */

        if (
            dashboardView.classList.contains(
                "active-view"
            )
        ) {

            renderizarDashboard();

        } else if (
            estadoApp.materiaActual
        ) {

            /*
             * Si está viendo una materia,
             * reconstruimos únicamente esa vista.
             */

            abrirMateria(
                estadoApp.materiaActual,
                estadoApp.registroObjetivo,
                false
            );

        }

    } catch (error) {

        /*
         * El fallo en segundo plano no destruye
         * la sesión que ya funciona con caché.
         */

        console.warn(
            "No se pudo actualizar el caché:",
            error
        );

    }

}


/* =========================================================
   ACTUALIZACIÓN MANUAL / ESTADO DE DATOS
========================================================= */

async function actualizarDatosManualmente() {

    if (estadoApp.actualizandoDatos) {
        return;
    }

    estadoApp.actualizandoDatos = true;
    actualizarIndicadorActualizacion(true);

    try {
        const datos =
            await descargarDatos();

        cargarEstadoDesdeDatos(
            datos.materias,
            datos.registros
        );

        guardarCache(
            datos.materias,
            datos.registros
        );

        estadoApp.usandoCache = false;
        estadoApp.ultimaActualizacion = Date.now();
        estadoApp.ultimoError = null;
        estadoApp.actualizacionFallida = false;

        if (dashboardView.classList.contains("active-view")) {
            renderizarDashboard();
        } else if (estadoApp.materiaActual) {
            abrirMateria(
                estadoApp.materiaActual,
                estadoApp.registroObjetivo,
                false
            );
        }

    } catch (error) {
        console.error("No se pudieron actualizar los datos:", error);
        estadoApp.ultimoError = error;
        estadoApp.actualizacionFallida = true;
    } finally {
        estadoApp.actualizandoDatos = false;
        actualizarIndicadorActualizacion();
    }
}

function actualizarIndicadorActualizacion(actualizando = false) {

    if (lastUpdateText) {
        if (actualizando) {
            lastUpdateText.textContent = "Actualizando datos...";
        } else if (estadoApp.ultimaActualizacion) {
            lastUpdateText.textContent = `Última actualización: ${formatearTiempoRelativo(estadoApp.ultimaActualizacion)}`;
        } else if (estadoApp.ultimoError) {
            lastUpdateText.textContent = "No se pudo actualizar";
        } else {
            lastUpdateText.textContent = "Cargando datos...";
        }
    }

    if (lastUpdateExact) {
        if (actualizando) {
            lastUpdateExact.textContent = "Consultando Google Sheets...";
        } else if (estadoApp.ultimaActualizacion) {
            const aviso = estadoApp.actualizacionFallida
                ? " · No se pudo comprobar si hay cambios."
                : estadoApp.usandoCache
                    ? " · Comprobando si hay cambios..."
                    : "";

            lastUpdateExact.textContent = `Actualizado el ${formatearFechaHoraExacta(estadoApp.ultimaActualizacion)}${aviso}`;
        } else if (estadoApp.ultimoError) {
            lastUpdateExact.textContent = "No fue posible conectar con la fuente de datos.";
        } else {
            lastUpdateExact.textContent = "Conectando con la bitácora...";
        }
    }

    if (refreshDataButton) {
        refreshDataButton.disabled = estadoApp.actualizandoDatos;
        refreshDataButton.classList.toggle("is-refreshing", estadoApp.actualizandoDatos);
        refreshDataButton.setAttribute("aria-busy", estadoApp.actualizandoDatos ? "true" : "false");

        const textoBoton = refreshDataButton.querySelector(".refresh-data-label-text");
        if (textoBoton) {
            textoBoton.textContent = estadoApp.actualizandoDatos
                ? "Actualizando..."
                : "Actualizar datos";
        }
    }
}

function formatearTiempoRelativo(timestamp) {

    const diferencia = Math.max(0, Date.now() - timestamp);
    const segundos = Math.floor(diferencia / 1000);

    if (segundos < 10) return "hace unos segundos";
    if (segundos < 60) return `hace ${segundos} segundos`;

    const minutos = Math.floor(segundos / 60);
    if (minutos === 1) return "hace 1 minuto";
    if (minutos < 60) return `hace ${minutos} minutos`;

    const horas = Math.floor(minutos / 60);
    if (horas === 1) return "hace 1 hora";
    if (horas < 24) return `hace ${horas} horas`;

    const dias = Math.floor(horas / 24);
    if (dias === 1) return "hace 1 día";
    return `hace ${dias} días`;
}

function formatearFechaHoraExacta(timestamp) {

    try {
        return new Intl.DateTimeFormat("es-MX", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(new Date(timestamp));
    } catch {
        return new Date(timestamp).toLocaleString("es-MX");
    }
}

if (refreshDataButton) {
    refreshDataButton.addEventListener(
        "click",
        actualizarDatosManualmente
    );
}

/* =========================================================
   CARGAR ESTADO
========================================================= */

function cargarEstadoDesdeDatos(
    materias,
    registros
) {

    estadoApp.materias =
        Array.isArray(materias)
            ? materias
            : [];


    estadoApp.registros =
        Array.isArray(registros)
            ? registros
            : [];


    estadoApp.pendientes =
        obtenerPendientesLocales(
            estadoApp.registros
        );

}


/* =========================================================
   API
========================================================= */

async function obtenerDatos(action) {

    const url =
        `${API_URL}?action=${encodeURIComponent(action)}`;


    const response =
        await fetch(
            url,
            {
                method: "GET",
                cache: "no-store"
            }
        );


    if (!response.ok) {

        throw new Error(
            `Error HTTP: ${response.status}`
        );

    }


    const data =
        await response.json();


    if (
        !data ||
        !data.success
    ) {

        throw new Error(
            data?.error ||
            "Error desconocido en la API."
        );

    }


    return data;

}


/* =========================================================
   CACHÉ LOCAL
========================================================= */

function obtenerCache() {

    try {

        const raw =
            localStorage.getItem(
                CACHE_KEY
            );


        if (!raw) {
            return null;
        }


        const cache =
            JSON.parse(raw);


        if (
            !cache ||
            !cache.timestamp ||
            !Array.isArray(cache.materias) ||
            !Array.isArray(cache.registros)
        ) {

            localStorage.removeItem(
                CACHE_KEY
            );

            return null;

        }


        const edad =
            Date.now() -
            cache.timestamp;


        if (
            edad > CACHE_DURATION
        ) {

            localStorage.removeItem(
                CACHE_KEY
            );

            return null;

        }


        return cache;

    } catch (error) {

        console.warn(
            "No se pudo leer el caché:",
            error
        );

        return null;

    }

}


function guardarCache(
    materias,
    registros
) {

    try {

        localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
                timestamp: Date.now(),
                materias,
                registros
            })
        );

    } catch (error) {

        console.warn(
            "No se pudo guardar el caché:",
            error
        );

    }

}


/* =========================================================
   DASHBOARD
========================================================= */

function renderizarDashboard() {

    actualizarEstadisticas();

    mostrarMaterias();

    mostrarPendientes();

    actualizarResumenPendientes();

    ejecutarBusquedaGlobal();

}


/* =========================================================
   ESTADÍSTICAS
========================================================= */

function actualizarEstadisticas() {

    totalMaterias.textContent =
        estadoApp.materias.length;


    totalPendientes.textContent =
        estadoApp.pendientes.length;


    totalRegistros.textContent =
        estadoApp.registros.length;


    pendingSummary.textContent =
        estadoApp.pendientes.length === 0
            ? "Al día"
            : `${estadoApp.pendientes.length} pendientes`;

}


/* =========================================================
   MATERIAS
========================================================= */

function mostrarMaterias(
    materias = estadoApp.materias,
    termino = ""
) {

    subjectsContainer.innerHTML = "";


    const busqueda =
        normalizarTexto(
            termino
        );


    const materiasFiltradas =
        materias.filter(
            materia => {

                const nombre =
                    String(
                        materia
                    ).trim();


                if (!nombre) {
                    return false;
                }


                return normalizarTexto(
                    nombre
                ).includes(
                    busqueda
                );

            }
        );


    if (
        !materiasFiltradas.length
    ) {

        mostrarMensaje(
            subjectsContainer,
            busqueda
                ? "No se encontró ninguna materia."
                : "No hay materias disponibles."
        );

        return;

    }


    materiasFiltradas.forEach(
        (materia, index) => {

            const nombreMateria =
                String(
                    materia
                ).trim();


            const card =
                document.createElement(
                    "article"
                );

            card.className =
                "subject-card";


            const number =
                document.createElement(
                    "span"
                );

            number.className =
                "subject-number";

            number.textContent =
                String(
                    index + 1
                ).padStart(
                    2,
                    "0"
                );


            const title =
                document.createElement(
                    "h3"
                );

            title.textContent =
                nombreMateria;


            const arrow =
                document.createElement(
                    "span"
                );

            arrow.className =
                "subject-arrow";

            arrow.textContent =
                "→";


            card.appendChild(
                number
            );

            card.appendChild(
                title
            );

            card.appendChild(
                arrow
            );


            card.setAttribute(
                "role",
                "button"
            );

            card.setAttribute(
                "tabindex",
                "0"
            );

            card.setAttribute(
                "aria-label",
                `Abrir ${nombreMateria}`
            );


            card.addEventListener(
                "click",
                () => abrirMateria(
                    nombreMateria
                )
            );


            card.addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter" ||
                        event.key === " "
                    ) {

                        event.preventDefault();

                        abrirMateria(
                            nombreMateria
                        );

                    }

                }
            );


            subjectsContainer.appendChild(
                card
            );

        }
    );

}


/* =========================================================
   BÚSQUEDA GLOBAL
========================================================= */

function ejecutarBusquedaGlobal() {

    const termino =
        normalizarTexto(
            estadoApp.busquedaGlobal
        );


    clearSearchButton.hidden =
        !termino;


    if (!termino) {

        searchResultsContainer.hidden =
            true;

        searchResultsContainer.innerHTML =
            "";

        mostrarMaterias();

        return;

    }


    const resultados =
        estadoApp.registros.filter(
            registro =>
                registroCoincideConBusqueda(
                    registro,
                    termino
                )
        );


    const materiasCoincidentes =
        estadoApp.materias.filter(
            materia =>
                normalizarTexto(
                    materia
                ).includes(
                    termino
                )
        );


    mostrarMaterias(
        materiasCoincidentes,
        termino
    );


    mostrarResultadosBusqueda(
        resultados
    );

}


function registroCoincideConBusqueda(
    registro,
    termino
) {

    const contenido = [

        registro.materia,

        registro.tipo,

        registro.tema,

        registro.descripcion,

        registro.estado

    ]
        .map(normalizarTexto)
        .join(" ");


    return contenido.includes(
        termino
    );

}


function mostrarResultadosBusqueda(
    resultados
) {

    searchResultsContainer.innerHTML = "";


    if (!resultados.length) {

        searchResultsContainer.hidden =
            false;

        mostrarMensaje(
            searchResultsContainer,
            "No se encontraron registros."
        );

        return;

    }


    searchResultsContainer.hidden =
        false;


    const titulo =
        document.createElement(
            "p"
        );

    titulo.className =
        "search-results-title";

    titulo.textContent =
        `${resultados.length} registro${
            resultados.length === 1
                ? ""
                : "s"
        } encontrado${
            resultados.length === 1
                ? ""
                : "s"
        }`;


    searchResultsContainer.appendChild(
        titulo
    );


    resultados
        .slice(0, 10)
        .forEach(
            registro => {

                const item =
                    crearResultadoBusqueda(
                        registro
                    );

                searchResultsContainer.appendChild(
                    item
                );

            }
        );


    if (
        resultados.length > 10
    ) {

        const more =
            document.createElement(
                "p"
            );

        more.className =
            "empty-message";

        more.textContent =
            `Mostrando 10 de ${resultados.length} resultados.`;

        searchResultsContainer.appendChild(
            more
        );

    }

}


function crearResultadoBusqueda(
    registro
) {

    const item =
        document.createElement(
            "article"
        );

    item.className =
        "search-result-item";


    const title =
        document.createElement(
            "h4"
        );

    title.textContent =
        registro.tema ||
        "Sin título";


    const subject =
        document.createElement(
            "p"
        );

    subject.textContent =
        registro.materia ||
        "Sin materia";


    const status =
        document.createElement(
            "span"
        );

    status.textContent =
        registro.estado ||
        "Sin estado";


    item.appendChild(
        title
    );

    item.appendChild(
        subject
    );

    item.appendChild(
        status
    );


    item.setAttribute(
        "role",
        "button"
    );

    item.setAttribute(
        "tabindex",
        "0"
    );


    const abrir =
        () => {

            const materia =
                registro.materia;

            if (!materia) {
                return;
            }

            estadoApp.busquedaGlobal =
                "";

            globalSearch.value =
                "";

            abrirMateria(
                materia,
                obtenerIdentificadorRegistro(
                    registro
                )
            );

        };


    item.addEventListener(
        "click",
        abrir
    );


    item.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" ||
                event.key === " "
            ) {

                event.preventDefault();

                abrir();

            }

        }
    );


    return item;

}


/* =========================================================
   PENDIENTES
========================================================= */

function obtenerPendientesLocales(
    registros
) {

    return registros
        .filter(
            registro =>
                normalizarTexto(
                    registro.estado
                ) === "pendiente"
        )
        .sort(
            compararPrioridadPendiente
        );

}


function compararPrioridadPendiente(
    a,
    b
) {

    const prioridadA =
        obtenerPrioridadPendiente(
            a
        );

    const prioridadB =
        obtenerPrioridadPendiente(
            b
        );


    if (
        prioridadA.nivel !==
        prioridadB.nivel
    ) {

        return (
            prioridadA.nivel -
            prioridadB.nivel
        );

    }


    const fechaA =
        convertirFechaOrdenable(
            a.fechaEntrega
        );

    const fechaB =
        convertirFechaOrdenable(
            b.fechaEntrega
        );


    if (
        fechaA === null &&
        fechaB === null
    ) {
        return 0;
    }


    if (fechaA === null) {
        return 1;
    }


    if (fechaB === null) {
        return -1;
    }


    return fechaA - fechaB;

}


function obtenerPrioridadPendiente(
    registro
) {

    const estadoFecha =
        obtenerEstadoFecha(
            registro.fechaEntrega
        );


    switch (
        estadoFecha.clase
    ) {

        case "overdue":

            return {
                nivel: 0,
                etiqueta: "URGENTE"
            };


        case "today":

            return {
                nivel: 1,
                etiqueta: "HOY"
            };


        case "soon":

            return {
                nivel: 2,
                etiqueta: "PRÓXIMO"
            };


        case "future":

        default:

            return {
                nivel: 3,
                etiqueta: "FUTURO"
            };

    }

}


function mostrarPendientes() {

    pendingContainer.innerHTML = "";


    if (
        !estadoApp.pendientes.length
    ) {

        mostrarMensaje(
            pendingContainer,
            "🎉 No tienes pendientes."
        );

        return;

    }


    estadoApp.pendientes.forEach(
        pendiente => {

            const item =
                document.createElement(
                    "article"
                );


            const estadoFecha =
                obtenerEstadoFecha(
                    pendiente.fechaEntrega
                );


            const prioridad =
                obtenerPrioridadPendiente(
                    pendiente
                );


            item.className =
                `pending-item ${estadoFecha.clase}`;


            const top =
                document.createElement(
                    "div"
                );

            top.className =
                "pending-top";


            const status =
                document.createElement(
                    "span"
                );

            status.className =
                "pending-status";

            status.textContent =
                `${estadoFecha.icono} ${prioridad.etiqueta}`;


            const title =
                document.createElement(
                    "h4"
                );

            title.textContent =
                pendiente.tema ||
                "Sin título";


            const subject =
                document.createElement(
                    "p"
                );

            subject.className =
                "pending-subject";

            subject.textContent =
                pendiente.materia ||
                "Sin materia";


            const bottom =
                document.createElement(
                    "div"
                );

            bottom.className =
                "pending-bottom";


            const date =
                document.createElement(
                    "span"
                );

            date.className =
                "pending-date";

            date.textContent =
                estadoFecha.texto;


            const type =
                document.createElement(
                    "span"
                );

            type.className =
                "pending-type";

            type.textContent =
                pendiente.tipo ||
                "Registro";


            top.appendChild(
                status
            );


            bottom.appendChild(
                date
            );

            bottom.appendChild(
                type
            );


            item.appendChild(
                top
            );

            item.appendChild(
                title
            );

            item.appendChild(
                subject
            );

            item.appendChild(
                bottom
            );


            if (
                pendiente.materia
            ) {

                item.setAttribute(
                    "role",
                    "button"
                );

                item.setAttribute(
                    "tabindex",
                    "0"
                );


                const abrir =
                    () => {

                        abrirMateria(
                            String(
                                pendiente.materia
                            ),
                            obtenerIdentificadorRegistro(
                                pendiente
                            )
                        );

                    };


                item.addEventListener(
                    "click",
                    abrir
                );


                item.addEventListener(
                    "keydown",
                    event => {

                        if (
                            event.key === "Enter" ||
                            event.key === " "
                        ) {

                            event.preventDefault();

                            abrir();

                        }

                    }
                );

            }


            pendingContainer.appendChild(
                item
            );

        }
    );

}


function actualizarResumenPendientes() {

    const pendientes =
        estadoApp.pendientes;


    if (!pendientes.length) {

        pendingSummary.textContent =
            "Al día";

        return;

    }


    const urgentes =
        pendientes.filter(
            registro => {

                const clase =
                    obtenerEstadoFecha(
                        registro.fechaEntrega
                    ).clase;

                return (
                    clase === "overdue" ||
                    clase === "today"
                );

            }
        ).length;


    if (urgentes) {

        pendingSummary.textContent =
            `${urgentes} requieren atención`;

    } else {

        pendingSummary.textContent =
            `${pendientes.length} pendientes`;

    }

}


/* =========================================================
   ESTADO DE FECHAS
========================================================= */

function obtenerEstadoFecha(
    fechaEntrega
) {

    if (!fechaEntrega) {

        return {

            estado: "SIN FECHA",

            texto: "Sin fecha de entrega",

            clase: "future",

            icono: "📌"

        };

    }


    const entrega =
        convertirFechaLocal(
            fechaEntrega
        );


    if (!entrega) {

        return {

            estado: "SIN FECHA",

            texto: "Fecha no válida",

            clase: "future",

            icono: "📌"

        };

    }


    const hoy =
        new Date();


    hoy.setHours(
        0,
        0,
        0,
        0
    );


    const diferencia =
        Math.round(
            (
                entrega -
                hoy
            ) /
            (
                1000 *
                60 *
                60 *
                24
            )
        );


    if (
        diferencia < 0
    ) {

        const dias =
            Math.abs(
                diferencia
            );


        return {

            estado: "VENCIDO",

            texto:
                dias === 1
                    ? "Venció ayer"
                    : `Venció hace ${dias} días`,

            clase: "overdue",

            icono: "🔴"

        };

    }


    if (
        diferencia === 0
    ) {

        return {

            estado: "HOY",

            texto: "Entrega hoy",

            clase: "today",

            icono: "🟢"

        };

    }


    if (
        diferencia === 1
    ) {

        return {

            estado: "PRÓXIMO",

            texto: "Entrega mañana",

            clase: "soon",

            icono: "🟠"

        };

    }


    if (
        diferencia <= 7
    ) {

        return {

            estado: "PRÓXIMO",

            texto:
                `Entrega en ${diferencia} días`,

            clase: "soon",

            icono: "🟠"

        };

    }


    return {

        estado: "FUTURO",

        texto:
            `Entrega en ${diferencia} días`,

        clase: "future",

        icono: "🔵"

    };

}


/* =========================================================
   FECHAS
========================================================= */

function convertirFechaLocal(
    fecha
) {

    if (!fecha) {
        return null;
    }


    if (
        fecha instanceof Date
    ) {

        return fecha;

    }


    const texto =
        String(
            fecha
        ).trim();


    const partes =
        texto.split("-");


    if (
        partes.length === 3
    ) {

        const year =
            Number(
                partes[0]
            );

        const month =
            Number(
                partes[1]
            );

        const day =
            Number(
                partes[2]
            );


        if (
            !year ||
            !month ||
            !day
        ) {

            return null;

        }


        const date =
            new Date(
                year,
                month - 1,
                day
            );


        return isNaN(
            date.getTime()
        )
            ? null
            : date;

    }


    const date =
        new Date(
            texto
        );


    return isNaN(
        date.getTime()
    )
        ? null
        : date;

}


function convertirFechaOrdenable(
    fecha
) {

    const date =
        convertirFechaLocal(
            fecha
        );


    if (!date) {
        return null;
    }


    return date.getTime();

}


function formatearFecha(
    fecha
) {

    const date =
        convertirFechaLocal(
            fecha
        );


    if (!date) {
        return "Sin fecha";
    }


    return date.toLocaleDateString(
        "es-MX",
        {
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    );

}


/* =========================================================
   ABRIR MATERIA
========================================================= */

function abrirMateria(
    materia,
    registroObjetivo = null,
    hacerScroll = true
) {

    if (!materia) {
        return;
    }


    const nombreMateria =
        String(
            materia
        ).trim();


    const materiaNormalizada =
        normalizarTexto(
            nombreMateria
        );


    const registros =
        estadoApp.registros
            .filter(
                registro =>
                    normalizarTexto(
                        registro.materia
                    ) ===
                    materiaNormalizada
            )
            .sort(
                compararFechasRegistro
            );


    estadoApp.materiaActual =
        nombreMateria;


    estadoApp.registrosMateriaActual =
        registros;


    estadoApp.filtroActual =
        "todo";


    estadoApp.busquedaHistorial =
        "";


    estadoApp.registroObjetivo =
        registroObjetivo;


    if (historySearch) {

        historySearch.value =
            "";

    }


    dashboardView.classList.remove(
        "active-view"
    );


    subjectView.classList.add(
        "active-view"
    );


    subjectTitle.textContent =
        nombreMateria;


    breadcrumbSubject.textContent =
        nombreMateria;


    actualizarInformacionMateria(
        registros
    );


    actualizarBotonesFiltro();


    aplicarFiltroHistorial();


    /*
     * Si llegamos desde un pendiente o desde una búsqueda,
     * NO hacemos un scroll independiente hasta el inicio.
     * El enfoque exacto del registro se encarga de llevarnos
     * directamente a la actividad/tarea seleccionada.
     * Evitamos así que dos scrolls suaves compitan entre sí.
     */
    if (hacerScroll && !registroObjetivo) {

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

}


/* =========================================================
   INFORMACIÓN DE MATERIA
========================================================= */

function actualizarInformacionMateria(
    registros
) {

    const actividades =
        registros.filter(
            registro =>
                normalizarTexto(
                    registro.tipo
                ) === "actividad"
        );


    const tareas =
        registros.filter(
            registro =>
                normalizarTexto(
                    registro.tipo
                ) === "tarea"
        );


    const pendientes =
        registros.filter(
            registro =>
                normalizarTexto(
                    registro.estado
                ) === "pendiente"
        );


    subjectTotal.textContent =
        registros.length;


    subjectActivities.textContent =
        actividades.length;


    subjectTasks.textContent =
        tareas.length;


    if (!registros.length) {

        subjectSubtitle.textContent =
            "Aún no hay registros para esta materia.";

        return;

    }


    subjectSubtitle.textContent =
        `${registros.length} registros · ${pendientes.length} pendientes`;

}


/* =========================================================
   HISTORIAL + FILTROS
========================================================= */

function aplicarFiltroHistorial() {

    let registros =
        [...estadoApp.registrosMateriaActual];


    const filtro =
        estadoApp.filtroActual;


    if (
        filtro !== "todo"
    ) {

        registros =
            registros.filter(
                registro => {

                    const tipo =
                        normalizarTexto(
                            registro.tipo
                        );

                    const estado =
                        normalizarTexto(
                            registro.estado
                        );


                    if (
                        filtro === "pendiente"
                    ) {

                        return estado === "pendiente";

                    }


                    if (
                        filtro === "completado"
                    ) {

                        return estado === "completado";

                    }


                    return tipo === filtro;

                }
            );

    }


    const busqueda =
        normalizarTexto(
            estadoApp.busquedaHistorial
        );


    if (busqueda) {

        registros =
            registros.filter(
                registro =>
                    registroCoincideConBusqueda(
                        registro,
                        busqueda
                    )
            );

    }


    mostrarHistorial(
        registros
    );

}


function mostrarHistorial(
    registros
) {

    historyContainer.innerHTML = "";


    if (!registros.length) {

        mostrarMensaje(
            historyContainer,
            estadoApp.busquedaHistorial
                ? "No se encontraron registros con esa búsqueda."
                : "No hay registros que coincidan con este filtro."
        );

        return;

    }


    registros.forEach(
        registro => {

            const item =
                crearRegistroHistorial(
                    registro
                );


            historyContainer.appendChild(
                item
            );

        }
    );


    /*
     * Si venimos desde un pendiente o
     * resultado de búsqueda, localizamos
     * exactamente el registro.
     */

    if (
        estadoApp.registroObjetivo
    ) {

        requestAnimationFrame(
            () => {

                enfocarRegistro(
                    estadoApp.registroObjetivo
                );

            }
        );

    }

}


function crearRegistroHistorial(
    registro
) {

    const item =
        document.createElement(
            "article"
        );


    item.className =
        "history-item";


    const identificador =
        obtenerIdentificadorRegistro(
            registro
        );


    if (identificador) {

        item.id =
            `registro-${identificador}`;

    }


    const estado =
        normalizarTexto(
            registro.estado
        );


    let estadoClase = "";


    if (
        estado === "pendiente"
    ) {

        estadoClase =
            "pending";

    } else if (
        estado === "completado"
    ) {

        estadoClase =
            "completed";

    }


    const top =
        document.createElement(
            "div"
        );

    top.className =
        "history-top";


    const titleContainer =
        document.createElement(
            "div"
        );


    const type =
        document.createElement(
            "span"
        );

    type.className =
        "history-type";

    type.textContent =
        registro.tipo ||
        "REGISTRO";


    const title =
        document.createElement(
            "h3"
        );

    title.textContent =
        registro.tema ||
        "Sin tema";


    titleContainer.appendChild(
        type
    );

    titleContainer.appendChild(
        title
    );


    const status =
        document.createElement(
            "span"
        );

    status.className =
        `status ${estadoClase}`;

    status.textContent =
        registro.estado ||
        "Sin estado";


    top.appendChild(
        titleContainer
    );

    top.appendChild(
        status
    );


    const description =
        document.createElement(
            "p"
        );

    description.className =
        "history-description";

    description.textContent =
        registro.descripcion ||
        "Sin descripción disponible.";


    const details =
        document.createElement(
            "div"
        );

    details.className =
        "history-details";


    const registrationDate =
        document.createElement(
            "span"
        );

    registrationDate.className =
        "history-detail";

    registrationDate.textContent =
        `📅 Registro: ${formatearFecha(
            registro.fecha
        )}`;


    const deliveryDate =
        document.createElement(
            "span"
        );

    deliveryDate.className =
        "history-detail";

    deliveryDate.textContent =
        `⏳ Entrega: ${formatearFecha(
            registro.fechaEntrega
        )}`;


    details.appendChild(
        registrationDate
    );

    details.appendChild(
        deliveryDate
    );


    const link =
        registro.enlace
            ? crearEnlaceSeguro(
                registro.enlace
            )
            : null;


    item.appendChild(
        top
    );

    item.appendChild(
        description
    );

    item.appendChild(
        details
    );


    if (link) {

        item.appendChild(
            link
        );

    }


    return item;

}


/* =========================================================
   ENFOCAR REGISTRO EXACTO
========================================================= */

function enfocarRegistro(
    identificador
) {

    if (!identificador) {
        return;
    }


    const elemento =
        document.getElementById(
            `registro-${identificador}`
        );


    if (!elemento) {

        estadoApp.registroObjetivo =
            null;

        return;

    }


    elemento.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });


    elemento.classList.add(
        "registro-destacado"
    );


    setTimeout(
        () => {

            elemento.classList.remove(
                "registro-destacado"
            );

            estadoApp.registroObjetivo =
                null;

        },
        3000
    );

}


/* =========================================================
   IDENTIFICAR REGISTRO
========================================================= */

function obtenerIdentificadorRegistro(
    registro
) {

    if (!registro) {
        return null;
    }


    /*
     * Preferimos ID de Google Sheets.
     */

    if (
        registro.id !== undefined &&
        registro.id !== null &&
        String(registro.id).trim()
    ) {

        return limpiarIdentificador(
            registro.id
        );

    }


    /*
     * Si no existe ID, construimos uno estable.
     */

    const base = [

        registro.materia,

        registro.tipo,

        registro.tema,

        registro.fecha,

        registro.fechaEntrega

    ]
        .map(
            valor =>
                normalizarTexto(
                    valor
                )
        )
        .join("|");


    return limpiarIdentificador(
        hashSimple(
            base
        )
    );

}


function limpiarIdentificador(
    valor
) {

    return String(
        valor
    )
        .trim()
        .replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
        );

}


function hashSimple(
    texto
) {

    let hash = 0;


    for (
        let i = 0;
        i < texto.length;
        i++
    ) {

        hash =
            (
                (
                    hash << 5
                ) -
                hash
            ) +
            texto.charCodeAt(i);


        hash |= 0;

    }


    return Math.abs(
        hash
    ).toString(
        36
    );

}


/* =========================================================
   ENLACES
========================================================= */

function crearEnlaceSeguro(
    url
) {

    try {

        const enlace =
            new URL(
                String(
                    url
                ).trim()
            );


        if (
            enlace.protocol !== "http:" &&
            enlace.protocol !== "https:"
        ) {

            return null;

        }


        const link =
            document.createElement(
                "a"
            );


        link.href =
            enlace.href;


        link.target =
            "_blank";


        link.rel =
            "noopener noreferrer";


        link.className =
            "history-link";


        link.textContent =
            "Abrir enlace →";


        return link;

    } catch {

        return null;

    }

}


/* =========================================================
   NAVEGACIÓN
========================================================= */

function volverAlDashboard() {

    estadoApp.materiaActual =
        null;


    estadoApp.registrosMateriaActual =
        [];


    estadoApp.filtroActual =
        "todo";


    estadoApp.busquedaHistorial =
        "";


    estadoApp.registroObjetivo =
        null;


    if (historySearch) {

        historySearch.value =
            "";

    }


    /*
     * Al regresar al dashboard limpiamos también el estado visual
     * de la búsqueda global. Antes solo se borraba el texto del
     * input en algunos flujos, pero no se volvía a renderizar el
     * listado completo de materias/resultados.
     */
    estadoApp.busquedaGlobal = "";

    if (globalSearch) {
        globalSearch.value = "";
    }

    subjectView.classList.remove(
        "active-view"
    );


    dashboardView.classList.add(
        "active-view"
    );


    /*
     * Con la búsqueda vacía, esta función elimina los resultados
     * anteriores y reconstruye todas las materias del dashboard.
     */
    ejecutarBusquedaGlobal();


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    actualizarBotonesFiltro();

}


function irAlDashboard() {

    volverAlDashboard();

}


/* =========================================================
   MODAL DE BIENVENIDA — PRIMERA VISITA
========================================================= */

function mostrarBienvenidaPrimeraVisita() {

    if (!welcomeModal) {
        return;
    }

    try {

        const yaVioBienvenida =
            localStorage.getItem(
                WELCOME_SEEN_KEY
            );

        if (yaVioBienvenida === "true") {
            return;
        }

        welcomeModal.hidden = false;
        document.body.classList.add(
            "welcome-modal-open"
        );

        setTimeout(
            () => {
                if (welcomeModalButton) {
                    welcomeModalButton.focus();
                }
            },
            50
        );

    } catch (error) {

        console.warn(
            "No se pudo comprobar la bienvenida:",
            error
        );

        welcomeModal.hidden = false;
        document.body.classList.add(
            "welcome-modal-open"
        );

    }

}


function cerrarBienvenida() {

    if (!welcomeModal) {
        return;
    }

    try {

        localStorage.setItem(
            WELCOME_SEEN_KEY,
            "true"
        );

    } catch (error) {

        console.warn(
            "No se pudo guardar el estado de bienvenida:",
            error
        );

    }

    welcomeModal.hidden = true;
    document.body.classList.remove(
        "welcome-modal-open"
    );

}


if (welcomeModalButton) {

    welcomeModalButton.addEventListener(
        "click",
        cerrarBienvenida
    );

}


if (closeWelcomeModal) {

    closeWelcomeModal.addEventListener(
        "click",
        cerrarBienvenida
    );

}


if (welcomeModal) {

    welcomeModal.addEventListener(
        "click",
        event => {

            if (
                event.target.matches(
                    "[data-close-welcome]"
                )
            ) {
                cerrarBienvenida();
            }

        }
    );

}


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape" &&
            welcomeModal &&
            !welcomeModal.hidden
        ) {
            cerrarBienvenida();
        }

    }
);


mostrarBienvenidaPrimeraVisita();


/* =========================================================
   EVENTOS DE NAVEGACIÓN
========================================================= */

backButton.addEventListener(
    "click",
    volverAlDashboard
);


breadcrumbDashboard.addEventListener(
    "click",
    irAlDashboard
);


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape" &&
            subjectView.classList.contains(
                "active-view"
            )
        ) {

            volverAlDashboard();

        }

    }
);


/* =========================================================
   EVENTOS DE BÚSQUEDA
========================================================= */

globalSearch.addEventListener(
    "input",
    () => {

        estadoApp.busquedaGlobal =
            globalSearch.value;


        ejecutarBusquedaGlobal();

    }
);


clearSearchButton.addEventListener(
    "click",
    () => {

        globalSearch.value =
            "";


        estadoApp.busquedaGlobal =
            "";


        ejecutarBusquedaGlobal();


        globalSearch.focus();

    }
);


historySearch.addEventListener(
    "input",
    () => {

        estadoApp.busquedaHistorial =
            historySearch.value;


        aplicarFiltroHistorial();

    }
);


/* =========================================================
   FILTROS
========================================================= */

filterButtons.forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                estadoApp.filtroActual =
                    button.dataset.filter;


                actualizarBotonesFiltro();


                aplicarFiltroHistorial();

            }
        );

    }
);


function actualizarBotonesFiltro() {

    filterButtons.forEach(
        button => {

            const activo =
                button.dataset.filter ===
                estadoApp.filtroActual;


            button.classList.toggle(
                "active-filter",
                activo
            );

        }
    );

}


/* =========================================================
   CARGA / ERROR / REINTENTO
========================================================= */

function mostrarCarga() {

    mostrarMensaje(
        subjectsContainer,
        "Cargando materias..."
    );


    mostrarMensaje(
        pendingContainer,
        "Cargando pendientes..."
    );


    totalMaterias.textContent =
        "—";


    totalPendientes.textContent =
        "—";


    totalRegistros.textContent =
        "—";


    pendingSummary.textContent =
        "Cargando...";

}


function mostrarError() {

    subjectsContainer.innerHTML =
        "";


    pendingContainer.innerHTML =
        "";


    const mensajeMaterias =
        crearMensajeError(
            "No se pudieron cargar los datos."
        );


    subjectsContainer.appendChild(
        mensajeMaterias
    );


    const mensajePendientes =
        crearMensajeError(
            "No se pudieron cargar los pendientes."
        );


    pendingContainer.appendChild(
        mensajePendientes
    );


    totalMaterias.textContent =
        "—";


    totalPendientes.textContent =
        "—";


    totalRegistros.textContent =
        "—";


    pendingSummary.textContent =
        "Error";


    const retry =
        document.createElement(
            "button"
        );


    retry.type =
        "button";


    retry.className =
        "retry-button";


    retry.textContent =
        "Reintentar";


    retry.addEventListener(
        "click",
        () => {

            iniciarAplicacion();

        }
    );


    pendingContainer.appendChild(
        retry
    );

}


function crearMensajeError(
    mensaje
) {

    const element =
        document.createElement(
            "p"
        );


    element.className =
        "empty-message error-message";


    element.textContent =
        mensaje;


    return element;

}


function mostrarMensaje(
    container,
    mensaje
) {

    const element =
        document.createElement(
            "p"
        );


    element.className =
        "empty-message";


    element.textContent =
        mensaje;


    container.appendChild(
        element
    );

}


/* =========================================================
   NORMALIZACIÓN
========================================================= */

function normalizarTexto(
    texto
) {

    return String(
        texto ?? ""
    )
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        );

}


/* =========================================================
   ORDENAMIENTO
========================================================= */

function compararFechasRegistro(
    a,
    b
) {

    const fechaA =
        convertirFechaOrdenable(
            a.fecha
        );


    const fechaB =
        convertirFechaOrdenable(
            b.fecha
        );


    if (
        fechaA === null &&
        fechaB === null
    ) {

        return 0;

    }


    if (fechaA === null) {
        return 1;
    }


    if (fechaB === null) {
        return -1;
    }


    return fechaB - fechaA;

}


/* =========================================================
   ACTUALIZAR EL TIEMPO RELATIVO
========================================================= */

setInterval(() => {
    if (estadoApp.ultimaActualizacion && !estadoApp.actualizandoDatos) {
        actualizarIndicadorActualizacion();
    }
}, 30000);

/* =========================================================
   INICIAR
========================================================= */

iniciarAplicacion();