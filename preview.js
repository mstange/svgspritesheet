var gSvgString;
var animationRAF;
// the colors to match and replace in the svg
let subsituteColors = {
  fill: [],
  stroke: []
};
// the colors we'll preview with
let previewColors = {
  fill: "#f00",
  stroke: "#0f0"
};

let inputImg = document.querySelector("img") || document.querySelector("image");
let outputDocument = null;

let params = new URLSearchParams(document.location.search.substring(1));
console.log("URL params: ", params);
if (params.has("src")) {
  inputImg.src = params.get("src");
}

// get and process the image data
let src = inputImg.src;
console.log("Using image: ", src);
fetch(src).then(resp => {
  return resp.text();
}).then(content => {
  let parser = new DOMParser();
  return parser.parseFromString(content.toString(), "image/svg+xml");
}).then(svgDoc => {
  if (svgDoc) {
    console.log("got svgDoc: ", svgDoc);
    outputDocument = svgDoc;
    render(outputDocument);
  } else {
    console.log("what no svgDoc");
  }
});

function updateConfig() {
  subsituteColors.fill = [];
  subsituteColors.stroke = [];
  ['fill', 'stroke'].forEach(name => {
    let nodeId = name + 'Colors';
    for (let value of document.getElementById(nodeId).value.split(';')) {
      value = value.trim().toLowerCase();
      if (value.startsWith('context-')) {
        subsituteColors[name].push(value);
      } else if (value.startsWith('rgb(')) {
        subsituteColors[name].push(value);
        try {
          let hexColor = rgbToHex(value);
          console.log('Converted %s to %s', value, hexColor);
          subsituteColors[name].push(hexColor);
        } catch(ex) {
          console.log('Failed to convert %s to hex: %s\n%s', value, ex.name, ex.description);
        }
      } else if (value.startsWith('#')) {
        subsituteColors[name].push(value);
        try {
          let rgbColor = hexToRgb(value);
          console.log('Converted %s to %s', value, rgbColor);
          subsituteColors[name].push(rgbColor);
        } catch(ex) {
          console.log('Failed to convert %s to rgb: %s\n%s', value, ex.name, ex.description);
        }
      } else {
        subsituteColors[name].push(value);
      }
    }
  });
  console.log('updateConfig, result: ', subsituteColors);
}

let SVG_SHAPES = {'rect': 1, 'path': 1, 'circle': 1, 'ellipse': 1, 'line': 1, 'polyline': 1, 'polygon': 1};

function isShape(elm) {
  return elm.localName in SVG_SHAPES;
}

function hexToRgb(str) {
  if (str.startsWith('#')) {
    str = str.substring(1);
  }
  if (str.length == 3) {
    str = str.replace(/([A-Fa-f0-9])/g, '$1$1');
  }
  let red = parseInt(str.substring(0, 2), 16);
  let green = parseInt(str.substring(2, 4), 16);
  let blue = parseInt(str.substring(4, 6), 16);
  return `rgb(${red},${green},${blue})`;
}
function rgbToHex(str) {
  let red=0, green=0, blue=0, alpha=1;
  let match;
  if (match = str.trim().match(/rgb\((\d+),\s*(\d+), ,\s*(\d+)\)/)) {
    red = match[1];
    green = match[2];
    blue = match[3];
  }

  const isPercent = (red + (alpha || '')).toString().includes('%');

  if (typeof red === 'string') {
    const res = red.match(/(0?\.?\d{1,3})%?\b/g).map(Number);
    // TODO: use destructuring when targeting Node.js 6
    red = res[0];
    green = res[1];
    blue = res[2];
    alpha = res[3];
  } else if (alpha !== undefined) {
    alpha = parseFloat(alpha);
  }

  if (typeof red !== 'number' ||
    typeof green !== 'number' ||
    typeof blue !== 'number' ||
    red > 255 ||
    green > 255 ||
    blue > 255) {
    throw new TypeError('Expected three numbers below 256');
  }

  if (typeof alpha === 'number') {
    if (!isPercent && alpha >= 0 && alpha <= 1) {
      alpha = Math.round(255 * alpha);
    } else if (isPercent && alpha >= 0 && alpha <= 100) {
      alpha = Math.round(255 * alpha / 100);
    } else {
      throw new TypeError(`Expected alpha value (${alpha}) as a fraction or percentage`);
    }
    alpha = (alpha | 1 << 8).toString(16).slice(1);
  } else {
    alpha = '';
  }
  let hexColor = ((blue | green << 8 | red << 16) | 1 << 24).toString(16).slice(1) + alpha;
  return '#' + hexColor.toLowerCase();
}

function getAnimationDimensions(svgElement) {
  let dims = {
    animationWidth: parseFloat(svgElement.getAttribute("width")),
    animationHeight: parseFloat(svgElement.getAttribute("height"))
  };
  dims.frameWidth = dims.animationWidth;
  dims.frameHeight = dims.animationHeight;

  let [frame1, frame2] = svgElement.getElementsByTagName('svg');
  if (frame1.hasAttribute("width")) {
    dims.frameWidth = Math.min(parseFloat(frame1.getAttribute("width")), dims.frameWidth);
  } else if(frame2 && frame2.hasAttribute("x")) {
    dims.frameWidth = Math.min(parseFloat(frame2.getAttribute("x")), dims.frameWidth);
  }
  if (frame1.hasAttribute("height")) {
    dims.frameHeight = Math.min(parseFloat(frame1.getAttribute("height")), dims.frameHeight);
  } else if(frame2 && frame2.hasAttribute("y")) {
    dims.frameHeight = Math.min(parseFloat(frame2.getAttribute("y")), dims.frameHeight);
  }
  return dims;
}

function render(svgDoc) {
  if (animationRAF) {
    cancelAnimationFrame(animationRAF);
  }
  let docElement;
  let outputContainer = document.getElementById("output");
  if (svgDoc) {
    while (outputContainer.firstChild) {
      outputContainer.removeChild(outputContainer.firstChild);
    }
    outputContainer.appendChild(svgDoc.documentElement);
    let serializer = new XMLSerializer();
    gSvgString = serializer.serializeToString(svgDoc);
  }
  docElement = outputContainer.firstChild;

  if (!docElement) {
    console.warn("No document to render");
    return;
  }

  updateConfig();

  window.gSVGDocumentElement = docElement;

  let colorsFound = {
    fill: new Map(),
    stroke: new Map()
  };

  for(let elm of docElement.getElementsByTagName("*")) {
    if (isShape(elm)) {
      let stroke = elm.hasAttribute("stroke") ? elm.getAttribute("stroke").toLowerCase() : null;
      if (stroke == "none") {
        stroke = null;
      }
      let fill = elm.hasAttribute("fill") ? elm.getAttribute("fill").toLowerCase() : null;
      if (fill == "none") {
        fill = null;
      }
      if (stroke)
      {
        if (subsituteColors.stroke.includes(stroke)) {
          elm.setAttribute("stroke", previewColors.stroke);
        } else if(subsituteColors.fill.includes(fill)) {
          elm.setAttribute("stroke", previewColors.fill);
        }
        let count = colorsFound.stroke.get(stroke) || 0;
        colorsFound.stroke.set(stroke, ++count);
      }
      if (fill)
      {
        if (subsituteColors.fill.includes(fill)) {
          elm.setAttribute("fill", previewColors.fill);
        } else if(subsituteColors.stroke.includes(fill)) {
          elm.setAttribute("fill", previewColors.stroke);
        }
        let count = colorsFound.fill.get(fill) || 0;
        colorsFound.fill.set(fill, ++count);
      }
    }
  };

  function renderColorsFound(colorCounts) {
    let colors = [];
    for(let [name, count] of colorCounts) {
      colors.push(`${name} (${count})`);
    }
    return colors.join(", ");
  }

  document.getElementById("preview-fill").style.backgroundColor = previewColors.fill;
  document.getElementById("preview-stroke").style.backgroundColor = previewColors.stroke;
  document.getElementById("fill-colors-found").textContent = renderColorsFound(colorsFound.fill);
  document.getElementById("stroke-colors-found").textContent = renderColorsFound(colorsFound.stroke);

  let dims = getAnimationDimensions(docElement);
  console.log("getAnimationDimensions: ", dims);

  let previewInner = document.getElementById("preview-inner");
  let previewOuter = document.getElementById("preview-outer");
  previewOuter.style.width = dims.frameWidth + "px";
  previewOuter.style.height = dims.frameHeight + "px";
  previewInner.style.width = dims.animationWidth + "px";
  previewInner.style.height = dims.animationHeight + "px";

  // let svgString = docElement.outerHTML;
  let parser = new DOMParser();
  console.log("outerHTML: ", btoa(docElement.outerHTML));
  let svgString = docElement.outerHTML;
  // let tmpDoc = parser.parseFromString(docElement.outerHTML, "image/svg+xml");
  // var serializer = new XMLSerializer();
  // var svgString = serializer.serializeToString(tmpDoc);
  // console.log("serialized: ", btoa(svgString));

  let exampleSVG = "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDE2IDE2Ij4KICA8cGF0aCBkPSJNOCwxMkwzLDcsNCw2bDQsNCw0LTQsMSwxWiIgZmlsbD0iIzZBNkE2QSIgLz4KPC9zdmc+Cg==";
  // console.log("animationUrl: ", animationUrl);
  let animationUrl = "data:image/svg+xml;base64," +  btoa(svgString);
  let backgroundImageValue = 'url(' + animationUrl + ')';
  previewInner.style.backgroundImage = backgroundImageValue;
  // console.log("value: ", backgroundImageValue);

  let offsetX = 0;
  let direction = -1;
  function animate() {
    let newOffsetX = offsetX + direction * dims.frameWidth;
    if (Math.abs(newOffsetX) > dims.animationWidth) {
      offsetX = 0; // direction *= -1;
      newOffsetX = offsetX + direction * dims.frameWidth;
    }
    offsetX = newOffsetX;
    previewInner.style.transform = `translateX(${offsetX}px)`;
    animationRAF = requestAnimationFrame(animate);
  }

  // update keyframe animation
  let frameCount = Math.floor(dims.animationWidth / dims.frameWidth) - 1;
  let lastFrameX = dims.animationWidth - dims.frameWidth;
  let rules = document.styleSheets[0].cssRules;
  for (let rule of rules) {
    if (rule.selectorText == '#preview-inner') {
      rule.style['animation-duration'] = frameCount/60 +'s';
      rule.style['animation-timing-function'] = `steps(${frameCount})`;
      console.log('updated rule for ' + rule.selectorText + 'to: ' + rule.cssText);
    }
    if (rule instanceof CSSKeyframesRule) {
      console.log("lastFrameX: ", lastFrameX);
      console.log(rule.cssRules[1].style.transform = `translateX(-${lastFrameX}px)`);
      console.log('updated last keyframe to: \n' + rule.cssText);
    }
  }

}
