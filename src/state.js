"use strict";

var L = require("leaflet");
var links = require("./links");

var State = L.Class.extend({
  options: {},

  initialize: function (map, lrm_control, tools, default_options) {
    this._lrm = lrm_control;
    this._map = map;
    this._tools = tools;

    this.set(default_options);

    this._lrm.on(
      "routeselected",
      function (e) {
        this.options.alternative = e.route.routesIndex;
      },
      this
    );

    this._lrm.getPlan().on(
      "waypointschanged",
      function () {
        this.options.waypoints = this._lrm.getWaypoints();
        var ropt = this._lrm.options.router.options,
          i;
        for (i = 0; i < ropt.services.length; i++) {
          if (ropt.serviceUrl === ropt.services[i].path)
            this.options.service = i;
        }
        this.update();
      }.bind(this)
    );
    this._map.on(
      "zoomend",
      function () {
        this.options.zoom = this._map.getZoom();
        this.update();
      }.bind(this)
    );
    this._map.on(
      "moveend",
      function () {
        this.options.center = this._map.getCenter();
        this.update();
      }.bind(this)
    );
    this._tools.on(
      "languagechanged",
      function (e) {
        this.options.language = e.language;
        this.reload();
      }.bind(this)
    );
    this._tools.on(
      "unitschanged",
      function (e) {
        this.options.units = e.unit;
        this.update();
      }.bind(this)
    );
  },

  get: function () {
    return this.options;
  },

  set: function (options) {
    var self = this;
    var container = document.getElementsByClassName(
      "leaflet-control-container"
    )[0];
    var url = new URL(window.location.href);
    var srvActive = url.searchParams.get("srv");

    var buttonsServices = L.DomUtil.create("div", "button-services", container);
    var car = L.DomUtil.create(
      "button",
      "button-services-action",
      buttonsServices
    );
    var foot = L.DomUtil.create(
      "button",
      "button-services-action",
      buttonsServices
    );

    if (srvActive == 0) {
      L.DomUtil.addClass(car, "hover-button");
    }

    if (srvActive == 2) {
      L.DomUtil.addClass(foot, "hover-button");
    }

    L.setOptions(this, options);
    L.Util.setOptions(this._lrm.options.router, {
      serviceUrl:
        this._lrm.options.router.options.services[this.options.service].path,
    });
    var profileSelector = L.DomUtil.get("profile-selector");
    profileSelector.selectedIndex = this.options.service;
    var services = self._lrm.options.router.options.services;
    L.DomEvent.addListener(profileSelector, "change", function () {
      console.log("first");
      if (
        profileSelector.selectedIndex >= 0 &&
        profileSelector.selectedIndex < services.length
      ) {
        self._tools.setProfile(services[profileSelector.selectedIndex]);
      }
    });
    if (this.options.service >= 0 && this.options.service < services.length) {
      self._tools.setProfile(services[this.options.service]);
    }

    L.DomEvent.addListener(car, "click", function () {
      var searchParams = new URLSearchParams(window.location.search);
      searchParams.set("srv", "0");
      window.location.search = searchParams.toString();
    });

    L.DomEvent.addListener(foot, "click", function () {
      var searchParams = new URLSearchParams(window.location.search);
      searchParams.set("srv", "2");
      window.location.search = searchParams.toString();
    });
    this._lrm.setWaypoints(this.options.waypoints);
    this._map.setView(this.options.center, this.options.zoom);
  },

  reload: function () {
    this.update();
    window.location.reload();
  },

  // Update browser url
  update: function () {
    var baseURL = window.location.href.split("?")[0];
    var newParms = links.format(this.options);
    var newURL = baseURL.concat("?").concat(newParms);
    window.location.hash = newParms;
    history.replaceState({}, "Project OSRM Demo", newURL);
  },
});

module.exports = function (map, lrm_control, tools, default_options) {
  return new State(map, lrm_control, tools, default_options);
};
