"use strict";

var L = require("leaflet");
var Geocoder = require("leaflet-control-geocoder");
var LRM = require("leaflet-routing-machine");
var locate = require("leaflet.locatecontrol");
var options = require("./lrm_options");
var links = require("./links");
var leafletOptions = require("./leaflet_options");
var ls = require("local-storage");
var tools = require("./tools");
var state = require("./state");
var localization = require("./localization");
require("./polyfill");

var parsedOptions = links.parse(window.location.search.slice(1));
var mergedOptions = L.extend(leafletOptions.defaultState, parsedOptions);
var local = localization.get(mergedOptions.language);

//Location
var initLatitude, initLongitude;
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(showPosition);
} else {
  document.getElementById("window").innerHTML =
    "Geolocation is not supported by this browser.";
}

function showPosition(position) {
  initLatitude = position.coords.latitude;
  initLongitude = position.coords.longitude;
}

// load only after language was chosen
var itineraryBuilder = require("./itinerary_builder")(mergedOptions.language);

var mapLayer = leafletOptions.layer;
var overlay = leafletOptions.overlay;
var baselayer = ls.get("layer")
  ? mapLayer[0][ls.get("layer")]
  : mapLayer[0]["openstreetmap.org"];
var layers =
  (ls.get("getOverlay") && [baselayer, overlay["hiking"]]) || baselayer;
var map = L.map("map", {
  zoomControl: true,
  dragging: true,
  layers: layers,
  maxZoom: 18,
}).setView(mergedOptions.center, mergedOptions.zoom);

// Pass basemap layers
mapLayer = mapLayer.reduce(function (title, layer) {
  title[layer.label] = L.tileLayer(layer.tileLayer, {
    id: layer.label,
  });
  return title;
});

/* Leaflet Controls */
L.control
  .layers(mapLayer, overlay, {
    position: "bottomleft",
  })
  .addTo(map);

L.control.scale().addTo(map);

/* set about text to attribution control */
map.attributionControl.setPrefix(local["About"]);

/* Store User preferences */
// store baselayer changes
map.on("baselayerchange", function (e) {
  ls.set("layer", e.name);
});
// store overlay add or remove
map.on("overlayadd", function (e) {
  ls.set("getOverlay", true);
});
map.on("overlayremove", function (e) {
  ls.set("getOverlay", false);
});

/* OSRM setup */
var ReversablePlan = L.Routing.Plan.extend({
  createGeocoders: function () {
    var container = L.Routing.Plan.prototype.createGeocoders.call(this);
    return container;
  },
});

/* Setup markers */
function makeIcon(i, n) {
  var url = "images/marker-via-icon-2x.png";
  var markerList = [
    "images/marker-start-icon-2x.png",
    "images/marker-end-icon-2x.png",
  ];
  if (i === 0) {
    return L.icon({
      iconUrl: markerList[0],
      iconSize: [20, 56],
      iconAnchor: [10, 28],
    });
  }
  if (i === n - 1) {
    return L.icon({
      iconUrl: markerList[1],
      iconSize: [20, 56],
      iconAnchor: [10, 28],
    });
  } else {
    return L.icon({
      iconUrl: url,
      iconSize: [20, 56],
      iconAnchor: [10, 28],
    });
  }
}

var plan = new ReversablePlan([], {
  geocoder: Geocoder.nominatim(),
  routeWhileDragging: true,
  createMarker: function (i, wp, n) {
    var options = {
      draggable: this.draggableWaypoints,
      icon: makeIcon(i, n),
    };
    var marker = L.marker(wp.latLng, options);

    marker.on("click", function () {
      plan.spliceWaypoints(i, 1);
    });
    return marker;
  },
  routeDragInterval: options.lrm.routeDragInterval,
  addWaypoints: true,
  waypointMode: "snap",
  position: "topright",
  useZoomParameter: options.lrm.useZoomParameter,
  reverseWaypoints: true,
  dragStyles: options.lrm.dragStyles,
  geocodersClassName: options.lrm.geocodersClassName,
  geocoderPlaceholder: function (i, n) {
    var startend = [
      local["Start - press enter to drop marker"],
      local["End - press enter to drop marker"],
    ];
    var via = [local["Via point - press enter to drop marker"]];
    if (i === 0) {
      return startend[0];
    }
    if (i === n - 1) {
      return startend[1];
    } else {
      return via;
    }
  },
});

L.extend(L.Routing, itineraryBuilder);

// add marker labels
var controlOptions = {
  plan: plan,
  routeWhileDragging: options.lrm.routeWhileDragging,
  lineOptions: options.lrm.lineOptions,
  altLineOptions: options.lrm.altLineOptions,
  summaryTemplate: options.lrm.summaryTemplate,
  containerClassName: options.lrm.containerClassName,
  alternativeClassName: options.lrm.alternativeClassName,
  stepClassName: options.lrm.stepClassName,
  language: "en", // we are injecting own translations via osrm-text-instructions
  showAlternatives: options.lrm.showAlternatives,
  units: mergedOptions.units,
  serviceUrl: leafletOptions.services[0].path,
  useHints: false,
  services: leafletOptions.services,
  useZoomParameter: options.lrm.useZoomParameter,
  routeDragInterval: options.lrm.routeDragInterval,
  collapsible: options.lrm.collapsible,
};
// translate profile names
for (
  var profile = 0, len = controlOptions.services.length;
  profile < len;
  profile++
) {
  controlOptions.services[profile].label =
    local[controlOptions.services[profile].label];
}

var router = new L.Routing.OSRMv1(controlOptions);
router._convertRouteOriginal = router._convertRoute;
router._convertRoute = function (responseRoute) {
  // monkey-patch L.Routing.OSRMv1 until it's easier to overwrite with a hook
  var resp = this._convertRouteOriginal(responseRoute);

  if (resp.instructions && resp.instructions.length) {
    var i = 0;
    responseRoute.legs.forEach(function (leg) {
      leg.steps.forEach(function (step) {
        // abusing the text property to save the original osrm step
        // for later use in the itnerary builder
        resp.instructions[i].text = step;
        i++;
      });
    });
  }

  return resp;
};
var lrmControl = L.Routing.control(
  Object.assign(controlOptions, {
    router: router,
  })
).addTo(map);

var toolsControl = tools
  .control(
    localization.get(mergedOptions.language),
    localization.getLanguages(),
    options.tools,
    [1, 2, 3]
  )
  .addTo(map);
var requestOptions = {
  method: "GET",
  redirect: "follow",
};

var data = null;

fetch(
  "https://monteserenoapp-91eed-default-rtdb.firebaseio.com/Points.json",
  requestOptions
)
  .then(function (response) {
    return response.text();
  })
  .then(function (result) {
    data = Object.values(JSON.parse(result));
    toolsControl.setPoints(data);
  })
  .catch(function (error) {
    return console.log("error", error);
  });

var state = state(map, lrmControl, toolsControl, mergedOptions);

plan.on("waypointgeocoded", function (e) {
  if (
    plan._waypoints.filter(function (wp) {
      return !!wp.latLng;
    }).length < 2
  ) {
    map.panTo(e.waypoint.latLng);
  }
});

function addWaypoint(waypoint) {
  var length = lrmControl.getWaypoints().filter(function (pnt) {
    return pnt.latLng;
  });
  length = length.length;
  if (!length) {
    //Initial destination
    lrmControl.spliceWaypoints(0, 1, waypoint);
  } else {
    if (length === 1) length = length + 1;
    //Final destination
    lrmControl.spliceWaypoints(length - 1, 1, waypoint);
  }
}

// User selected routes
lrmControl.on("alternateChosen", function (e) {
  var directions = document.querySelectorAll(".leaflet-routing-alt");
  if (directions[0].style.display != "none") {
    directions[0].style.display = "none";
    directions[1].style.display = "block";
  } else {
    directions[0].style.display = "block";
    directions[1].style.display = "none";
  }
});

// Route export
lrmControl.on("routeselected", function (e) {
  var route = e.route || {};
  var routeGeoJSON = {
    type: "Feature",
    properties: {
      name: route.name,
      copyright: {
        author: "Montesereno",
        license: "https://www.montesereno.com.co/",
      },
      link: {
        href: window.document.location.href,
        text: window.document.title,
      },
      time: new Date().toISOString(),
    },
    geometry: {
      type: "LineString",
      coordinates: (route.coordinates || []).map(function (coordinate) {
        return [coordinate.lng, coordinate.lat];
      }),
    },
  };
  toolsControl.setRouteGeoJSON(routeGeoJSON);
});
plan.on("waypointschanged", function (e) {
  if (
    !e.waypoints ||
    e.waypoints.filter(function (wp) {
      return !wp.latLng;
    }).length > 0
  ) {
    toolsControl.setRouteGeoJSON(null);
  }
});

L.control
  .locate({
    follow: false,
    setView: true,
    remainActive: false,
    keepCurrentZoomLevel: true,
    stopFollowingOnDrag: false,
    onLocationError: function (err) {
      alert(err.message);
    },
    onLocationOutsideMapBounds: function (context) {
      alert(context.options.strings.outsideMapBoundsMsg);
    },
    showPopup: false,
    locateOptions: {},
  })
  .addTo(map);

//Change to points search

var finalDestinyLat = null;
var finalDestinyLong = null;

addWaypoint();

function addCustomWaypoint(origin, destination) {
  lrmControl.spliceWaypoints(0, 1, origin);
  lrmControl.spliceWaypoints(1, 1, destination);
}

/*
setInterval(function () {
  navigator.geolocation.getCurrentPosition(showPosition);
  //addWaypoint();
  if (localStorage.getItem("point")) {
    var point = JSON.parse(localStorage.getItem("point"));
    if (finalDestinyLat != point.lat) {
      finalDestinyLat = point.lat;
      finalDestinyLong = point.lan;
    }
  }
  if (finalDestinyLat && finalDestinyLong) {
    console.log(finalDestinyLat, finalDestinyLong);
    addCustomWaypoint(
      L.latLng(initLatitude, initLongitude),
      L.latLng(finalDestinyLat, finalDestinyLong)
    );
  }
}, 2000);*/

var url = new URL(window.location.href);

if (!url.searchParams.get("srv")) {
  localStorage.clear();
} else {
  var point = localStorage.getItem("point");
  point
    ? (document.getElementsByClassName("share-container")[0].value =
        JSON.parse(point).lote)
    : null;
}

var id;
var target;
var options;

function success(pos) {
  const crd = pos.coords;
  initLatitude = crd.latitude;
  initLongitude = crd.longitude;

  if (localStorage.getItem("point")) {
    var point = JSON.parse(localStorage.getItem("point"));
    if (finalDestinyLat != point.lat) {
      finalDestinyLat = point.lat;
      finalDestinyLong = point.lan;
    }
  }
  if (finalDestinyLat && finalDestinyLong) {
    console.log(finalDestinyLat, finalDestinyLong);
    addCustomWaypoint(
      L.latLng(initLatitude, initLongitude),
      L.latLng(finalDestinyLat, finalDestinyLong)
    );
  }
}

function error(err) {
  console.error(err.code, err.message);
}

target = {
  latitude: 0,
  longitude: 0,
};

options = {
  enableHighAccuracy: true,
  timeout: 1500,
  maximumAge: 0,
};

id = navigator.geolocation.watchPosition(success, error, options);
