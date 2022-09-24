"use strict";

var L = require("leaflet");
var shortlink = require("./shortlink");
var JXON = require("jxon");
JXON.config({ attrPrefix: "@" });
var FileSaver = require("file-saver");

var Control = L.Control.extend({
  includes: L.Mixin.Events,
  options: {
    toolContainerClass: "",
    editorButtonClass: "",
    josmButtonClass: "",
    debugButtonClass: "",
    mapillaryButtonClass: "",
    shareButtonClass: "",
    gpxButtonClass: "",
    localizationChooserClass: "",
    finalDestinyLat: "",
  },

  initialize: function (localization, languages, options, points) {
    L.setOptions(this, options);
    this._local = localization;
    this._languages = languages;
    this._points = points;
  },

  onAdd: function (map) {
    var gpxContainer, gpxButton;
    this._container = L.DomUtil.create(
      "div",
      "leaflet-osrm-tools-container " + this.options.toolsContainerClass
    );
    L.DomEvent.disableClickPropagation(this._container);

    gpxContainer = L.DomUtil.create(
      "div",
      "leaflet-osrm-tools-gpx",
      this._container
    );
    gpxButton = L.DomUtil.create(
      "span",
      this.options.gpxButtonClass,
      gpxContainer
    );
    this._gpxButton = gpxButton;
    gpxButton.title = this._local["GPX"];
    gpxButton.setAttribute("disabled", "");
    L.DomEvent.on(gpxButton, "click", this._downloadGPX, this);
    this._localizationContainer = L.DomUtil.create(
      "div",
      "leaflet-osrm-tools-localization",
      this._container
    );
    //Custom Input
    this._drawSearch();
    this._createLocalizationList(this._localizationContainer);
    return this._container;
  },

  onRemove: function () {},

  _openEditor: function () {
    var position = this._map.getCenter(),
      zoom = this._map.getZoom(),
      prec = 6;
    window.open(
      "https://www.openstreetmap.org/edit?lat=" +
        position.lat.toFixed(prec) +
        "&lon=" +
        position.lng.toFixed(prec) +
        "&zoom=" +
        zoom
    );
  },

  _openJOSM: function () {
    var bounds = this._map.getBounds(),
      url =
        "http://127.0.0.1:8111/load_and_zoom" +
        "?left=" +
        bounds.getWest() +
        "&right=" +
        bounds.getEast() +
        "&bottom=" +
        bounds.getSouth() +
        "&top=" +
        bounds.getNorth();
    window.open(url);
  },

  _openDebug: function () {
    var position = this._map.getCenter(),
      zoom = this._map.getZoom(),
      prec = 6;
    window.open(
      "debug/" +
        this.profile.debug +
        ".html#" +
        zoom +
        "/" +
        position.lat.toFixed(prec) +
        "/" +
        position.lng.toFixed(prec)
    );
  },

  setProfile: function (profile) {
    this.profile = profile;
  },

  _openMapillary: function () {
    var position = this._map.getCenter(),
      zoom = this._map.getZoom(),
      prec = 6;
    window.open(
      "https://www.mapillary.com/app/?lat=" +
        position.lat.toFixed(prec) +
        "&lng=" +
        position.lng.toFixed(prec) +
        "&z=" +
        zoom
    );
  },

  _drawSearch: function () {
    var search = L.DomUtil.create("div", "search-firebase", this._container);
    var input = L.DomUtil.create("input", "share-container", search);
    input.setAttribute("placeholder", "Ingresa el lote hacia donde te diriges");
    L.DomUtil.create("div", "icon-search", search);
    const result = L.DomUtil.create("div", "results-search", search);

    L.DomEvent.on(
      input,
      "keypress",
      function (e) {
        var term = document.getElementsByClassName("share-container")[0].value;

        const findPoints = this._points.filter(function (point) {
          const _point = point.lote.toLowerCase();
          return _point.includes(term.toLowerCase());
        });
        const cutFindPoints = findPoints.slice(0, 5);

        result.innerHTML = "";
        var myUl = L.DomUtil.create("ul", "listSearch", result);

        cutFindPoints.map(function (_finded, index) {
          var myLi = L.DomUtil.create("li", "itemSearched", myUl);
          const liP = document.getElementsByClassName("itemSearched")[index];
          liP.innerHTML = "<p>" + _finded.lote + "</p>";
          L.DomEvent.on(myLi, "click", function (e) {
            this.finalDestinyLat = _finded.lat;
            this.finalDestinyLong = _finded.lan;
            input.value = _finded.lote;
            result.innerHTML = "";
            localStorage.setItem("point", JSON.stringify(_finded));
          });
        });
      },
      this
    );
  },
  _showSharePopup: function () {
    L.DomUtil.addClass(this._shareButton, "share-popup-visible");
    var overlay = L.DomUtil.create("div", "share-overlay", this._sharePopup);
    L.DomEvent.on(
      overlay,
      "click",
      function (e) {
        L.DomEvent.stopPropagation(e);
        this._hideSharePopup();
      },
      this
    );
    var container = L.DomUtil.create(
      "div",
      "share-container",
      this._sharePopup
    );
    L.DomEvent.on(container, "click", function (e) {
      L.DomEvent.stopPropagation(e);
    });
    var typeButtonContainer = L.DomUtil.create(
      "div",
      "share-type-button-container",
      container
    );
    var linkButton = L.DomUtil.create(
      "button",
      "share-type",
      typeButtonContainer
    );
    linkButton.textContent = this._local["Link"];
    var shortLinkButton = L.DomUtil.create(
      "button",
      "share-type selected",
      typeButtonContainer
    );
    shortLinkButton.textContent = this._local["Shortlink"];
    var input = L.DomUtil.create("input", "share-url", container);
    var url = window.document.location.href;
    shortlink.osmli(
      url,
      L.Util.bind(function (shortLink) {
        this._shortLink = shortLink;
        input.value = this._shortLink;
        input.select();
      }, this)
    );

    L.DomEvent.on(linkButton, "click", function () {
      if (!L.DomUtil.hasClass(linkButton, "selected")) {
        L.DomUtil.addClass(linkButton, "selected");
        L.DomUtil.removeClass(shortLinkButton, "selected");
        input.value = window.document.location.href;
        input.select();
      }
    });
    L.DomEvent.on(
      shortLinkButton,
      "click",
      function () {
        if (!L.DomUtil.hasClass(shortLinkButton, "selected")) {
          L.DomUtil.addClass(shortLinkButton, "selected");
          L.DomUtil.removeClass(linkButton, "selected");
          if (!this._shortLink) {
            var url = window.document.location.href;
            shortlink.osmli(
              url,
              L.Util.bind(function (shortLink) {
                this._shortLink = shortLink;
                input.value = this._shortLink;
                input.select();
              }, this)
            );
          } else {
            input.value = this._shortLink;
            input.select();
          }
        }
      },
      this
    );
  },

  _hideSharePopup: function () {
    this._shortLink = null;
    L.DomUtil.removeClass(this._shareButton, "share-popup-visible");
    while (this._sharePopup.lastChild) {
      this._sharePopup.removeChild(this._sharePopup.lastChild);
    }
  },

  setRouteGeoJSON: function (routeGeoJSON) {
    this.routeGeoJSON = routeGeoJSON;
    if (this.routeGeoJSON) {
      this._gpxButton.removeAttribute("disabled");
    } else {
      this._gpxButton.setAttribute("disabled", "");
    }
  },

  setPoints: function (points) {
    this._points = points;
  },
  _downloadGPX: function () {
    if (this.routeGeoJSON) {
      var properties = this.routeGeoJSON.properties;
      var metadata = {
        name: properties.name,
        copyright: {
          "@author": properties.copyright.author,
          license: properties.copyright.license,
        },
        link: {
          "@href": properties.link.href,
          text: properties.link.text,
        },
        time: properties.time,
      };
      var trackPoints = this.routeGeoJSON.geometry.coordinates.map(function (
        coordinate
      ) {
        return {
          "@lat": coordinate[1],
          "@lon": coordinate[0],
        };
      });
      var gpx = {
        gpx: {
          "@xmlns": "http://www.topografix.com/GPX/1/1",
          "@xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
          "@xsi:schemaLocation":
            "http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd",
          "@creator": "osrm",
          "@version": "1.1",
          metadata: metadata,
          trk: {
            trkseg: {
              trkpt: trackPoints,
            },
          },
        },
      };
      var gpxData = JXON.stringify(gpx);
      // Work around issues with XML name space generation in IE 11
      // (see also https://github.com/tyrasd/jxon/issues/42)
      gpxData = gpxData
        .replace(/\s+xmlns:NS\d+=""/g, "")
        .replace(/NS\d+:/g, "");
      var blob = new Blob(
        ['<?xml version="1.0" encoding="utf-8"?>', "\n", gpxData],
        {
          type: "application/gpx+xml;charset=utf-8",
        },
        false
      );
      FileSaver.saveAs(blob, "route.gpx");
    }
  },

  _updatePopupPosition: function (button) {
    var rect = this._container.getBoundingClientRect(),
      left = 0;
    if (button) {
      left = button.getBoundingClientRect().left - rect.left;
    }
    this._popupWindow.style.position = "absolute";
    this._popupWindow.style.left = left + "px";
    this._popupWindow.style.bottom = rect.height + "px";
  },

  _createLocalizationList: function (container) {
    var _this = this;
    var localizationSelect = L.DomUtil.create(
      "select",
      _this.options.localizationChooserClass,
      container
    );
    localizationSelect.setAttribute("title", _this._local["Select language"]);
    L.DomEvent.on(
      localizationSelect,
      "change",
      function (event) {
        this.fire("languagechanged", {
          language: event.target.value,
        });
      },
      _this
    );
    Object.keys(this._languages).forEach(function (key) {
      var option = L.DomUtil.create("option", "fill-osrm", localizationSelect);
      option.setAttribute("value", key);
      option.appendChild(document.createTextNode(_this._languages[key]));
      if (key == _this._local.key) {
        option.setAttribute("selected", "");
      }
    });
  },
});

module.exports = {
  control: function (localization, languages, options, points) {
    return new Control(localization, languages, options, points);
  },
};
