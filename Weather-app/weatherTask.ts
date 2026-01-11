function qs<T extends HTMLElement>(selector: string): T {
    const el = document.querySelector(selector);
    if (!el) {
        throw new Error(`Missing element: ${selector}`);
    }
    return el as T;
}

const unitsBtn = qs<HTMLButtonElement>("#unitsBtn");
const dropdown = qs<HTMLDivElement>("#unitsDropdown");
const todaySection = qs<HTMLDivElement>(".today-section");
const switchBtn = qs<HTMLButtonElement>(".switch-btn");
const searchWrapper = qs<HTMLDivElement>(".search-wrapper");

const searchBtn = qs<HTMLButtonElement>(".search-btn");
const searchInput = qs<HTMLInputElement>("#search-text");

const trigger = qs<HTMLButtonElement>("#dayBtn");
const dropdownDay = qs<HTMLDivElement>(".day-dropdown");
const menu = qs<HTMLUListElement>("#dayMenu");

const errorFetchCon = qs<HTMLDivElement>(".error-fetch-con");
const mainContent = qs<HTMLDivElement>(".main-con");
const searchCon = qs<HTMLDivElement>(".search-section");

const retryBtn = qs<HTMLButtonElement>(".retry-btn");
const loadingCon = qs<HTMLDivElement>(".loading-con");
const mainContToday = qs<HTMLDivElement>(".main-cont-today");
const weatherIcon = qs<HTMLImageElement>(".weather-icon");
const noResult = qs<HTMLParagraphElement>(".no-result");
const searchLoading = qs<HTMLDivElement>(".search-loading");

const DATA_SECTIONS: (HTMLElement | null)[] = [
    todaySection,
    mainContToday,
    document.querySelector(".info-cards-con"),
    document.querySelector(".forecast"),
    document.querySelector(".hour-forecast"),
];

interface Units {
    temperature: "celsius" | "fahrenheit";
    wind: "kmh" | "mph";
    precipitation: "mm" | "inch";
}

let currentUnits: Units = {
    temperature: "celsius",
    wind: "kmh",
    precipitation: "mm",
};

let lastCity: string = "Amman";
let lastWeatherData: WeatherResponse | null = null;
let latestRequestId = 0;

interface WeatherResponse {
    readonly current_weather: {
        readonly temperature: number;
        readonly windspeed: number;
        readonly weathercode: number;
        readonly time: string;
    };
    readonly hourly: {
        readonly time: string[];
        readonly temperature_2m: number[];
        readonly weathercode: number[];
        readonly apparent_temperature: number[];
        readonly relative_humidity_2m: number[];
        readonly precipitation: number[];
    };
    readonly daily: {
        readonly time: string[];
        readonly temperature_2m_min: number[];
        readonly temperature_2m_max: number[];
        readonly weathercode: number[];
    };
}

interface WeatherMapItem {
    text: string;
    icon: string;
}

const WEATHER_MAP: Record<number, WeatherMapItem> = {
    0: { text: "Clear sky", icon: "icon-sunny.webp" },
    1: { text: "Mainly clear", icon: "icon-sunny.webp" },
    2: { text: "Partly cloudy", icon: "icon-partly-cloudy.webp" },
    3: { text: "Overcast", icon: "icon-overcast.webp" },
    45: { text: "Fog", icon: "icon-fog.webp" },
    48: { text: "Fog", icon: "icon-fog.webp" },
    51: { text: "Light drizzle", icon: "icon-drizzle.webp" },
    53: { text: "Drizzle", icon: "icon-drizzle.webp" },
    55: { text: "Heavy drizzle", icon: "icon-drizzle.webp" },
    56: { text: "Freezing drizzle", icon: "icon-drizzle.webp" },
    57: { text: "Freezing drizzle", icon: "icon-drizzle.webp" },
    61: { text: "Rain", icon: "icon-rain.webp" },
    63: { text: "Rain", icon: "icon-rain.webp" },
    65: { text: "Heavy rain", icon: "icon-rain.webp" },
    66: { text: "Freezing rain", icon: "icon-rain.webp" },
    67: { text: "Freezing rain", icon: "icon-rain.webp" },
    71: { text: "Snow", icon: "icon-snow.webp" },
    73: { text: "Snow", icon: "icon-snow.webp" },
    75: { text: "Heavy snow", icon: "icon-snow.webp" },
    77: { text: "Snow grains", icon: "icon-snow.webp" },
    80: { text: "Rain showers", icon: "icon-rain.webp" },
    81: { text: "Rain showers", icon: "icon-rain.webp" },
    82: { text: "Heavy showers", icon: "icon-rain.webp" },
    85: { text: "Snow showers", icon: "icon-snow.webp" },
    86: { text: "Snow showers", icon: "icon-snow.webp" },
    95: { text: "Thunderstorm", icon: "icon-storm.webp" },
    96: { text: "Thunderstorm hail", icon: "icon-storm.webp" },
    99: { text: "Thunderstorm hail", icon: "icon-storm.webp" }
};

function wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

interface Coordinates {
    latitude: number;
    longitude: number;
    name: string;
    country: string;
}

async function getCoordinates(city: string): Promise<Coordinates | null> {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Geocoding failed");
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
        return null;
    }

    return {
        latitude: data.results[0].latitude,
        longitude: data.results[0].longitude,
        name: data.results[0].name,
        country: data.results[0].country
    };
}

function showSearchLoading(): void {
    searchLoading.classList.remove("display-none");
    searchBtn.disabled = true;
}

function hideSearchLoading(): void {
    searchLoading.classList.add("display-none");
    searchBtn.disabled = false;
}

function hideAllData(): void {
    DATA_SECTIONS.forEach(el => {
        if (el) el.classList.add("display-none");
    });

    weatherIcon.classList.add("display-none");
}

function setHourlyToToday(dailyTimes: string[]): void {
    if (!dailyTimes || !dailyTimes.length) return;

    const todayDate = dailyTimes[0];

    const triggerP = trigger.querySelector("p") as HTMLParagraphElement;
    triggerP.textContent = "Today";

    menu.querySelectorAll("li").forEach(li => li.classList.remove("active"));

    const todayLi = menu.querySelector(`li[data-date="${todayDate}"]`);
    if (todayLi) todayLi.classList.add("active");

    const todayHours = getHourlyForDay(lastWeatherData!.hourly, todayDate);
    renderHourly(todayHours);
}

function showAllData(): void {
    DATA_SECTIONS.forEach(el => {
        if (el) el.classList.remove("display-none");
    });

    weatherIcon.classList.remove("display-none");
}

function showError(): void {
    hideAllData();
    loadingCon.classList.add("display-none");
    errorFetchCon.classList.remove("display-none");
}

function showSuccess(): void {
    loadingCon.classList.add("display-none");
    errorFetchCon.classList.add("display-none");
    showAllData();
}

function showLoading(): void {
    loadingCon.classList.remove("display-none");
    todaySection.classList.remove("bg-show");
    mainContToday.classList.add("display-none");
    weatherIcon.classList.add("display-none");
}

interface SystemType {
    temperature_unit: "celsius" | "fahrenheit";
    wind_speed_unit: "kmh" | "mph";
    precipitation_unit: "mm" | "inch";
}

function getUnitParams(): SystemType {
    const prefs = JSON.parse(localStorage.getItem("unitPreferences") || "{}") as Record<string, string>;

    currentUnits.temperature =
        prefs["Temperature"] === "imperial" ? "fahrenheit" : "celsius";

    currentUnits.wind =
        prefs["Wind Speed"] === "imperial" ? "mph" : "kmh";

    currentUnits.precipitation =
        prefs["Precipitation"] === "imperial" ? "inch" : "mm";

    return {
        temperature_unit: currentUnits.temperature,
        wind_speed_unit: currentUnits.wind,
        precipitation_unit: currentUnits.precipitation
    };
}

interface HourlyData {
    time: string;
    temperature: number;
    weathercode: number;
}

function updateInfoCards(current: WeatherResponse["current_weather"], hourly: WeatherResponse["hourly"]): void {
    const now = new Date();
    const hourIndex = hourly.time.findIndex(
        t => new Date(t).getHours() === now.getHours()
    );

    if (hourIndex === -1) return;

    const feelsLikeEl = document.querySelector(".feels-like") as HTMLElement;
    const humidityEl = document.querySelector(".humidity") as HTMLElement;
    const windEl = document.querySelector(".wind") as HTMLElement;
    const precipitationEl = document.querySelector(".precipitation") as HTMLElement;

    if (!feelsLikeEl || !humidityEl || !windEl || !precipitationEl) return;

    feelsLikeEl.textContent =
        `${Math.round(hourly.apparent_temperature[hourIndex])}°`;

    humidityEl.textContent =
        `${hourly.relative_humidity_2m[hourIndex]}%`;

    windEl.textContent =
        `${Math.round(current.windspeed)} ${currentUnits.wind === "mph" ? "mph" : "km/h"}`;

    precipitationEl.textContent =
        `${hourly.precipitation[hourIndex]} ${currentUnits.precipitation === "inch" ? "in" : "mm"}`;
}

function updateDailyForecast(daily: WeatherResponse["daily"]): void {
    const cards = document.querySelectorAll(".forecast .card");

    if (!daily || cards.length === 0) return;

    daily.time.slice(0, cards.length).forEach((dateStr, i) => {
        const card = cards[i] as HTMLElement;
        if (!card) return;

        const dayEl = card.querySelector("p") as HTMLElement;
        const minEl = card.querySelector(".lower-temp") as HTMLElement;
        const maxEl = card.querySelector(".heighr-temp") as HTMLElement;

        const date = new Date(dateStr);
        dayEl.textContent = date.toLocaleDateString(undefined, {
            weekday: "short"
        });

        minEl.textContent =
            `${Math.round(daily.temperature_2m_min[i])}°`;

        maxEl.textContent =
            `${Math.round(daily.temperature_2m_max[i])}°`;

        const weather = WEATHER_MAP[daily.weathercode[i]];
        if (weather) {
            let img = card.querySelector("img") as HTMLImageElement;
            if (!img) {
                img = document.createElement("img");
                img.className = "day-forecast-icon";
                card.insertBefore(img, card.children[1]);
            }
            img.src = `assets/images/${weather.icon}`;
            img.alt = weather.text;
        }
    });
}

function updateHourlyForecast(hourly: WeatherResponse["hourly"]): void {
    const hourCards = document.querySelectorAll(".hour-temp-con");
    if (!hourCards.length) return;

    const now = new Date();
    const currentHour = now.getHours();

    let startIndex = hourly.time.findIndex(
        t => new Date(t).getHours() === currentHour
    );

    if (startIndex === -1) startIndex = 0;

    hourCards.forEach((card, i) => {
        const index = startIndex + i;
        if (!hourly.time[index]) return;

        const timeEl = card.querySelector(".hour-time") as HTMLElement;
        const tempEl = card.querySelector(".hour-temp") as HTMLElement;
        const iconWrap = card.querySelector(".hour-icon-con") as HTMLElement;

        const date = new Date(hourly.time[index]);
        const hour = date.getHours();
        const displayHour =
            hour === 0 ? "12 AM" :
            hour < 12 ? `${hour} AM` :
            hour === 12 ? "12 PM" :
            `${hour - 12} PM`;

        timeEl.textContent = displayHour;
        tempEl.textContent = `${Math.round(hourly.temperature_2m[index])}°`;

        let img = iconWrap.querySelector("img") as HTMLImageElement;
        if (!img) {
            img = document.createElement("img");
            img.className = "hour-icon";
            iconWrap.prepend(img);
        }

        const weather =
            WEATHER_MAP[hourly.weathercode[index]] ||
            { text: "Unknown", icon: "icon-cloud.webp" };

        img.src = `assets/images/${weather.icon}`;
        img.alt = weather.text;
    });
}

function getWeekday(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
        weekday: "long"
    });
}

function populateDaysDropdown(dailyTimes: string[]): void {
    menu.innerHTML = "";

    dailyTimes.forEach((dateStr, index) => {
        const li = document.createElement("li");

        li.textContent = index === 0 ? "Today" : getWeekday(dateStr);
        li.dataset.date = dateStr;

        if (index === 0) li.classList.add("active");

        menu.appendChild(li);
    });
}

function getHourlyForDay(hourly: WeatherResponse["hourly"], dateStr: string): HourlyData[] {
    const start = new Date(`${dateStr}T00:00`);
    const end = new Date(`${dateStr}T23:59`);

    return hourly.time
        .map((time, i) => ({
            time,
            temperature: hourly.temperature_2m[i],
            weathercode: hourly.weathercode[i]
        }))
        .filter(h => {
            const t = new Date(h.time);
            return t >= start && t <= end;
        });
}

function renderHourly(hours: HourlyData[]): void {
    const hourCards = document.querySelectorAll(".hour-temp-con");

    hourCards.forEach((card, i) => {
        if (!hours[i]) {
            card.classList.add("display-none");
            return;
        }

        card.classList.remove("display-none");

        const timeEl = card.querySelector(".hour-time") as HTMLElement;
        const tempEl = card.querySelector(".hour-temp") as HTMLElement;
        const iconWrap = card.querySelector(".hour-icon-con") as HTMLElement;

        const date = new Date(hours[i].time);

        const hour = date.getHours();
        const displayHour =
            hour === 0 ? "12 AM" :
            hour < 12 ? `${hour} AM` :
            hour === 12 ? "12 PM" :
            `${hour - 12} PM`;

        timeEl.textContent = displayHour;
        tempEl.textContent = `${Math.round(hours[i].temperature)}°`;

        let img = iconWrap.querySelector("img") as HTMLImageElement;
        if (!img) {
            img = document.createElement("img");
            img.className = "hour-icon";
            iconWrap.prepend(img);
        }

        const weather =
            WEATHER_MAP[hours[i].weathercode] ||
            { text: "Unknown", icon: "icon-cloud.webp" };

        img.src = `assets/images/${weather.icon}`;
        img.alt = weather.text;
    });
}

type SystemState = "metric" | "imperial" | "mixed";

function getCurrentSystem(): SystemState {
    const sections = document.querySelectorAll(".section");

    let allMetric = true;
    let allImperial = true;

    sections.forEach(section => {
        const selected = section.querySelector(".option.selected") as HTMLElement;

        if (selected && !selected.classList.contains("metric")) {
            allMetric = false;
        }
        if (selected && !selected.classList.contains("imperial")) {
            allImperial = false;
        }
    });

    if (allMetric) return "metric";
    if (allImperial) return "imperial";
    return "mixed";
}

function updateSwitchButton(): void {
    const state = getCurrentSystem();

    if (state === "metric") {
        switchBtn.textContent = "Switch to Imperial";
        switchBtn.dataset.state = "metric";
    } else if (state === "imperial") {
        switchBtn.textContent = "Switch to Metric";
        switchBtn.dataset.state = "imperial";
    } else {
        switchBtn.textContent = "Custom units";
        switchBtn.dataset.state = "mixed";
    }

    hideSearchLoading();
}

function savePreferences(): void {
    const data: Record<string, string> = {};

    document.querySelectorAll(".section").forEach(section => {
        const titleEl = section.querySelector(".section-title") as HTMLElement;
        const selected = section.querySelector(".option.selected") as HTMLElement;

        if (titleEl && selected) {
            const title = titleEl.textContent?.trim() || "";
            data[title] = selected.classList.contains("metric")
                ? "metric"
                : "imperial";
        }
    });

    localStorage.setItem("unitPreferences", JSON.stringify(data));

    fetchTodayWeather(lastCity, false);

    hideSearchLoading();
}

function restorePreferences(): void {
    const saved = JSON.parse(localStorage.getItem("unitPreferences") || "{}") as Record<string, string>;
    if (!Object.keys(saved).length) return;

    document.querySelectorAll(".section").forEach(section => {
        const titleEl = section.querySelector(".section-title") as HTMLElement;
        if (!titleEl) return;

        const title = titleEl.textContent?.trim() || "";
        const pref = saved[title];
        if (!pref) return;

        const target = section.querySelector(`.option.${pref}`) as HTMLElement;

        section.querySelectorAll(".option").forEach(o => {
            o.classList.remove("selected");
            o.querySelector(".checkmark")?.classList.remove("show");
        });

        if (target) {
            target.classList.add("selected");
            target.querySelector(".checkmark")?.classList.add("show");
        }
    });
}

async function fetchTodayWeather(city: string = lastCity, showLoader: boolean = true): Promise<void> {
    lastCity = city;
    const requestId = ++latestRequestId;

    errorFetchCon.classList.add("display-none");
    mainContent.classList.remove("display-none");
    searchCon.classList.remove("display-none");
    noResult.classList.add("display-none");

    if (showLoader) {
        showLoading();
    }

    try {
        const location = await getCoordinates(city);
        if (requestId !== latestRequestId) return;

        if (!location) {
            await wait(2000);

            hideSearchLoading();
            hideAllData();

            mainContent.classList.add("display-none");
            errorFetchCon.classList.add("display-none");
            noResult.classList.remove("display-none");

            return;
        }

        const units = getUnitParams();

        const url =
            `https://api.open-meteo.com/v1/forecast` +
            `?latitude=${location.latitude}` +
            `&longitude=${location.longitude}` +
            `&current_weather=true` +
            `&hourly=temperature_2m,weathercode,relative_humidity_2m,precipitation,apparent_temperature` +
            `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
            `&temperature_unit=${units.temperature_unit}` +
            `&wind_speed_unit=${units.wind_speed_unit}` +
            `&precipitation_unit=${units.precipitation_unit}` +
            `&timezone=auto`;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Weather fetch failed (${res.status})`);

        const data = await res.json() as WeatherResponse;
        if (!data.current_weather || !data.hourly) {
            throw new Error("Missing weather data");
        }

        lastWeatherData = data;

        await wait(2000);
        if (requestId !== latestRequestId) return;

        updateInfoCards(data.current_weather, data.hourly);
        updateDailyForecast(data.daily);
        populateDaysDropdown(data.daily.time);
        setHourlyToToday(data.daily.time);

        const current = data.current_weather;

        const locationEl = document.querySelector(".location") as HTMLElement;
        const dateEl = document.querySelector(".date") as HTMLElement;
        const tempEl = document.querySelector(".temperature") as HTMLElement;
        const iconEl = document.querySelector(".weather-icon") as HTMLImageElement;

        if (!locationEl || !dateEl || !tempEl || !iconEl) {
            throw new Error("Missing Today section elements in DOM");
        }

        locationEl.textContent = `${location.name}, ${location.country}`;

        const date = new Date(current.time);
        dateEl.textContent = date.toLocaleDateString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric"
        });

        tempEl.textContent = `${Math.round(current.temperature)}°`;

        const weather = WEATHER_MAP[current.weathercode] || {
            text: "Unknown",
            icon: "icon-cloud.webp"
        };

        iconEl.src = `assets/images/${weather.icon}`;
        iconEl.alt = weather.text;

        const todayCard = document.getElementById("todayCard");
        if (todayCard) todayCard.classList.add("bg-show");

        loadingCon.classList.add("display-none");
        todaySection.classList.add("bg-show");
        weatherIcon.classList.remove("display-none");
        mainContToday.classList.remove("display-none");
        errorFetchCon.classList.add("display-none");

        hideSearchLoading();
        showSuccess();

    } catch (error) {
        await wait(3000);
        if (requestId !== latestRequestId) return;

        hideSearchLoading();
        console.error("Fetch failed:", error);
        showError();
    }
}

// Unit switching
unitsBtn.addEventListener("click", () => {
    dropdown.classList.toggle("show");
    unitsBtn.classList.toggle("border-white");
});

document.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".units-wrapper")) {
        dropdown.classList.remove("show");
        unitsBtn.classList.remove("border-white");
    }
});

document.querySelectorAll(".option").forEach(option => {
    option.addEventListener("click", () => {
        const section = option.closest(".section") as HTMLElement;

        section.querySelectorAll(".option").forEach(o => {
            o.classList.remove("selected");
            o.querySelector(".checkmark")?.classList.remove("show");
        });

        option.classList.add("selected");
        option.querySelector(".checkmark")?.classList.add("show");

        updateSwitchButton();
        savePreferences();
    });
});

switchBtn.addEventListener("click", () => {
    const state = switchBtn.dataset.state;
    const useMetric = state !== "metric";

    document.querySelectorAll(".section").forEach(section => {
        const target = section.querySelector(
            useMetric ? ".option.metric" : ".option.imperial"
        ) as HTMLElement;

        section.querySelectorAll(".option").forEach(o => {
            o.classList.remove("selected");
            o.querySelector(".checkmark")?.classList.remove("show");
        });

        target.classList.add("selected");
        target.querySelector(".checkmark")?.classList.add("show");
    });

    updateSwitchButton();
    savePreferences();
});

// Day dropdown
trigger.addEventListener("click", (e: MouseEvent) => {
    e.stopPropagation();
    dropdownDay.classList.toggle("open");
});

menu.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== "LI") return;

    const active = menu.querySelector(".active");
    if (active) active.classList.remove("active");
    target.classList.add("active");

    const triggerP = trigger.querySelector("p") as HTMLParagraphElement;
    triggerP.textContent = target.textContent || "";

    if (!lastWeatherData) return;

    const selectedDate = target.dataset.date;

    const hours = getHourlyForDay(
        lastWeatherData.hourly,
        selectedDate || ""
    );

    renderHourly(hours);

    dropdownDay.classList.remove("open");
});

document.addEventListener("click", () => {
    dropdownDay.classList.remove("open");
});

// Search
searchBtn.addEventListener("click", () => {
    const city = searchInput.value.trim();
    if (!city) return;

    showSearchLoading();
    showLoading();
    fetchTodayWeather(city);
});

searchInput.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") {
        searchBtn.click();
    }
});

// Retry button
retryBtn.addEventListener("click", () => {
    errorFetchCon.classList.add("display-none");
    mainContent.classList.remove("display-none");
    searchCon.classList.remove("display-none");
    fetchTodayWeather(lastCity);
});

// Initialize
restorePreferences();
updateSwitchButton();
fetchTodayWeather("Amman");

export {};

