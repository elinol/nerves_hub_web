import '../css/app.scss'

import 'phoenix_html'
import 'bootstrap'
import { Socket } from 'phoenix'
import { LiveSocket } from 'phoenix_live_view'
import L from 'leaflet/dist/leaflet.js'
import Chart from 'chart.js/auto'
import 'chartjs-adapter-date-fns';

import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import elixir from 'highlight.js/lib/languages/elixir'
import plaintext from 'highlight.js/lib/languages/plaintext'
import shell from 'highlight.js/lib/languages/shell'
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('elixir', elixir)
hljs.registerLanguage('plaintext', plaintext)
hljs.registerLanguage('shell', shell)

import 'highlight.js/styles/stackoverflow-light.css'
import 'leaflet/dist/leaflet.css'

import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'

TimeAgo.addDefaultLocale(en)

let dates = require('./dates')

let Hooks = {}

Hooks.SharedSecretClipboardClick = {
  mounted() {
    const parent = this.el
    this.el.addEventListener('click', () => {
      const secret = document.getElementById('shared-secret-' + parent.value)
        .value
      if (typeof ClipboardItem && navigator.clipboard.write) {
        // NOTE: Safari locks down the clipboard API to only work when triggered
        //   by a direct user interaction. You can't use it async in a promise.
        //   But! You can wrap the promise in a ClipboardItem, and give that to
        //   the clipboard API.
        //   Found this on https://developer.apple.com/forums/thread/691873

        const type = 'text/plain'
        const blob = new Blob([secret], { type })
        const data = [new window.ClipboardItem({ [type]: blob })]
        navigator.clipboard.write(data)

        confirm('Secret copied to your clipboard')
      } else {
        // NOTE: Firefox has support for ClipboardItem and navigator.clipboard.write,
        //   but those are behind `dom.events.asyncClipboard.clipboardItem` preference.
        //   Good news is that other than Safari, Firefox does not care about
        //   Clipboard API being used async in a Promise.
        navigator.clipboard.writeText(secret)
        confirm('Secret copied to your clipboard')
      }
    })
  }
}

Hooks.Chart = {
  dataset() { return JSON.parse(this.el.dataset.metrics); },
  unit() { return JSON.parse(this.el.dataset.unit); },
  mounted() {
    let metrics = JSON.parse(this.el.dataset.metrics);
    let type = JSON.parse(this.el.dataset.type);
    let max = JSON.parse(this.el.dataset.max);
    let min = JSON.parse(this.el.dataset.min);
    let title = JSON.parse(this.el.dataset.title);

    const ctx = this.el;
    var data = [];
    for (let i = 0; i < metrics.length; i++) {
      data.push(metrics[i]);
    }

    const areaChartDataset = {
      type: 'line',
      data: {
        datasets: [{
          backgroundColor: '#d19999',
          fill: {
            target: 'start',
            above: 'rgba(201, 84, 84, 0.29)',
            below: 'rgba(201, 84, 84, 0.29)',
          },
          data: this.dataset()
        }],
      },
      options: {
        plugins: {
          title: {
            display: true,
            align: 'start',
            text: title,
            font: {
              size: 24
            }
          },
          legend: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              color: 'rgba(181, 169, 169, 0.21)'
            },
            type: 'time',
            time: {
              unit: this.unit(),
              displayFormats: {
                millisecond: 'HH:mm:ss.SSS',
                second: 'HH:mm:ss',
                minute: 'HH:mm',
                hour: 'HH:mm'
              },
            },
            ticks: {
              display: true,
              autoSkip: false,
              maxTicksLimit: 6,
            },
          },
          y: {
            offset: true,
            grid: {
              color: 'rgba(181, 169, 169, 0.21)'
            },
            type: 'linear',
            min: min,
            max: max
          }
        },
      }
    };

    const chart = new Chart(
      ctx,
      areaChartDataset
    );
    this.el.chart = chart;

    this.handleEvent("update-charts", function (payload) {
      if (payload.type == type) {
        chart.data.datasets[0].data = payload.data;
        chart.update();
      }
    })

    this.handleEvent("update-time-unit", function (payload) {
      chart.options.scales.x.time.unit = payload.unit;
      chart.update();
    })

  },
  updated() { }
}


Hooks.HighlightCode = {
  mounted() {
    this.updated()
  },
  updated() {
    hljs.highlightElement(this.el)
  }
}

Hooks.UpdatingTimeAgo = {
  updateTimer: null,
  mounted() {
    this.updateTimer = null
    this.updated()
  },
  updated(element) {
    let hook = arguments.length > 0 ? element : this

    if (hook.updateTimer) {
      clearTimeout(hook.updateTimer)
    }

    const timeAgo = new TimeAgo('en-US')

    let dtString = hook.el.dateTime
    let dt = new Date(dtString)

    const formattedDate = timeAgo.format(dt, 'round-minute')

    hook.el.textContent = formattedDate

    // https://www.npmjs.com/package/javascript-time-ago#update-interval
    // set update interval to 10sec
    let interval = 10000

    hook.updateTimer = setTimeout(hook.updated, interval, hook)
  }
}

Hooks.LocalTime = {
  mounted() {
    this.updated()
  },
  updated() {
    let dt = new Date(this.el.textContent.trim())

    dt.setSeconds(null)

    let formatted = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h12',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }).format(dt)

    this.el.textContent = formatted
  }
}

Hooks.SimpleDate = {
  mounted() {
    this.updated()
  },
  updated() {
    this.el.textContent = dates.formatDate(this.el.textContent)
  }
}

Hooks.WorldMap = {
  mounted() {
    let self = this;
    let mapId = this.el.id;
    this.markers = [];

    var mapOptionsNoZoom = {
      attributionControl: false,
      zoomControl: false,
      scrollWheelZoom: false,
      boxZoom: false,
      doubleClickZoom: false,
      dragging: false,
      keyboard: false
    };

    var mapStyle = {
      stroke: true,
      color: "#2A2D30",
      fillColor: "#b7bec5",
      weight: 0.5,
      opacity: 1,
      fillOpacity: 0.5
    };

    // initialize the map
    this.map = L.map(mapId, mapOptionsNoZoom).setView([40.5, 10], 2);
    this.handleEvent(
      "markers",
      ({ markers }) => {
        self.markers = markers;
        self.updated();
      }
    )

    // load GeoJSON from an external file
    fetch("/geo/world.geojson").then(res => res.json()).then(data => {
      L.geoJson(data, { style: mapStyle }).addTo(this.map);
      this.pushEvent("map_ready", {});
    });
  },
  updated() {
    let markers = this.markers;
    let mode = this.el.dataset.mode;
    var devices = [];

    for (let i = 0; i < markers.length; i++) {
      let marker = markers[i];
      let location = marker["location"];
      if (location["longitude"] !== undefined && location["latitude"] !== undefined) {
        let newMarker = {
          type: "Feature",
          properties: {
            name: marker["identifier"],
            status: marker["status"],
            latest_firmware: marker["latest_firmware"]
          },
          geometry: {
            type: "Point",
            coordinates: [location["longitude"], location["latitude"]]
          }
        }
        devices.push(newMarker);
      }
    }

    var markerConnectedOptions = {
      radius: 6,
      fillColor: "#4dd54f",
      weight: 1,
      opacity: 0,
      fillOpacity: 1
    };

    var markerOfflineOptions = {
      radius: 6,
      fillColor: "rgba(196,49,49,1)",
      weight: 1,
      opacity: 0,
      fillOpacity: 1
    };

    var markerUpdatedOptions = {
      radius: 6,
      fillColor: "#4dd54f",
      weight: 1,
      opacity: 0,
      fillOpacity: 1
    };

    var markerOutdatedOptions = {
      radius: 6,
      fillColor: "rgba(99,99,99,1)",
      weight: 1,
      opacity: 0,
      fillOpacity: 1
    };

    // Clear previous defined device layer before adding markers
    if (this.deviceLayer !== undefined) { this.map.removeLayer(this.deviceLayer); }

    this.deviceLayer = L.geoJson(devices, {
      pointToLayer: function (feature, latlng) {
        switch (mode) {
          case 'connected':
            if (feature.properties.status == "connected") {
              return L.circleMarker(latlng, markerConnectedOptions);
            } else {
              return L.circleMarker(latlng, markerOfflineOptions);
            }
            break;
          case 'updated':
            // Only show connected ones, the offline ones are just confusing
            if (feature.properties.status == "connected") {
              if (feature.properties.latest_firmware) {
                return L.circleMarker(latlng, markerUpdatedOptions);
              } else {
                return L.circleMarker(latlng, markerOutdatedOptions);
              }
            }
            break;
          default:
        }
      }
    });

    this.deviceLayer.addTo(this.map);
  }
}

let csrfToken = document
  .querySelector("meta[name='csrf-token']")
  .getAttribute('content')
let liveSocket = new LiveSocket('/live', Socket, {
  params: { _csrf_token: csrfToken },
  hooks: Hooks
})

liveSocket.connect()

document.querySelectorAll('.date-time').forEach(d => {
  d.innerHTML = dates.formatDateTime(d.innerHTML)
})

window.addEventListener('phx:sharedsecret:created', () => {
  confirm('A new Shared Secret has been created.')
})

window.addEventListener('ca:edit:jitp', () => {
  const checked = document.getElementById('jitp_toggle_ui').checked

  document.getElementById('jitp-delete').value = !checked

  if (checked) {
    document.getElementById('jitp_form').classList.remove('hidden')
  } else {
    document.getElementById('jitp_form').classList.add('hidden')
  }
})

window.addEventListener('ca:new:jitp', () => {
  const checked = document.getElementById('jitp_toggle_ui').checked

  document.getElementById('jitp_toggle').value = checked

  if (checked) {
    document.getElementById('jitp_form').classList.remove('hidden')
  } else {
    document.getElementById('jitp_form').classList.add('hidden')
  }
})
