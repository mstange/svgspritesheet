var gUniqueColors;
var animationRAF;

// the colors we'll preview with that get matched and replaced in the svg
let substituteColors = new Map([
  ["context-fill", "#f00"],
  ["context-stroke", "#0f0"]
]);

let gInputDocument, gOutputDocument;

async function main() {
  let svgDocument = await loadInputImage();
  gInputDocument = svgDocument;
  gUniqueColors = getUniqueColorsFromDocument(gInputDocument);

  console.log("got input document: ", gInputDocument);

  await updateUI(gUniqueColors);
  console.log("Input UI updated");

  update(gInputDocument);
  document.body.addEventListener("click", ui);
  document.body.addEventListener("change", ui);
}

function update() {
  let svgDocument = gInputDocument;

  let gOutputDocument = createOutputDocument(svgDocument);
  renderPreview(gOutputDocument);
  renderOutput(gOutputDocument);
}

let ui = {
  handleEvent(evt) {
    let target = evt.target;
    switch (evt.type) {
      case "click":
        // handle assignment checkbox clicks
        if (target.type == "checkbox" && target.name.endsWith("-assignment")) {
          return this.handleAssignmentCheckboxClick(target, evt);
        }
        break;
      case "change":
        if (target.type == "color" && (/(fill|stroke)Color/).test(target.id)) {
          return this.handlePreviewColorChange(target, evt);
        }
        break;
    }
  },
  handleAssignmentCheckboxClick(target, evt) {
    let siblings = Array.from(target.parentNode.querySelectorAll("[type='checkbox']"))
                    .filter(input => input !== target);
    if (target.name == "none-assignment") {
      // deselect the others
      if (target.checked) {
        siblings.forEach(input => {
          input.checked = false;
        });
      }
    } else {
      siblings.forEach(input => {
        if (input.name == "none-assignment") {
          input.checked = false;
        }
      });
    }
  },
  handlePreviewColorChange(target, evt) {
    switch (target.id) {
      case "fillColor":
        substituteColors.set("context-fill", target.value);
        break;
      case "strokeColor":
        substituteColors.set("context-stroke", target.value);
        break;
    }
  }
}

main();

function getElementsWithAttribute(rootElement) {
  let names = Array.from(arguments).slice(1);
  let elements = [rootElement].concat(Array.from(rootElement.getElementsByTagName("*")));
  let elementsWithAttribute = elements.filter(hasColor).filter(elm => {
    return names.some(name => {
      return hasAttributeWithValue(elm, name);
    });
  });
  return elementsWithAttribute;
}

function hasAttributeWithValue(elm, name) {
  let value = elm.getAttribute(name);
  return (value && value.toLowerCase() !== "none");
}

function getColorsFromDocument(doc) {
  let docElement = doc.documentElement;
  let fillElements = getElementsWithAttribute(docElement, "fill");
  let strokeElements = getElementsWithAttribute(docElement, "stroke");

  let colorsFound = new Set();
  let fillColors = new Map();
  let strokeColors = new Map();

  fillElements.forEach(elm => {
    let color = elm.getAttribute("fill").toLowerCase();
    let count = fillColors.get(color) || 0;
    fillColors.set(color, ++count);
    colorsFound.add(color);
  });
  strokeElements.forEach(elm => {
    let color = elm.getAttribute("stroke").toLowerCase();
    let count = strokeColors.get(color) || 0;
    strokeColors.set(color, ++count);
    colorsFound.add(color);
  });
  console.log("getColorsFromDocument: fillColors: ", fillColors);
  console.log("getColorsFromDocument: strokeColors: ", strokeColors);
  return colorsFound;
}

// ----------------------------------------
// utils
//
function normalizeColorValue(color) {
  let value = color.trim().toLowerCase();
  if (value.startsWith('rgb(')) {
    try {
      let hexColor = rgbToHex(value);
      return hexColor;
    } catch(ex) {
      console.warn('Failed to convert %s to hex: %s\n%s', value, ex.name, ex.description);
      return value;
    }
  }
  if (value.startsWith('#') && value.length == 4) {
    value = "#" + value.substring(1).replace(/(.)/g, "$1$1");
  }
  return value;
}

function replaceColorsInDocument(doc, colorReplacementMap) {
  console.log("replaceColorsInDocument got map: ", colorReplacementMap);
  let colorElements = getElementsWithAttribute(doc.documentElement, "fill", "stroke");
  colorElements.forEach(elm => {
    if (hasAttributeWithValue(elm, "fill")) {
      let color = elm.getAttribute("fill");
      let normalizedColor = normalizeColorValue(color);
      if (colorReplacementMap.has(normalizedColor)) {
        // console.log("replace fill %s with %s", color, colorReplacementMap.get(normalizedColor));
        elm.setAttribute("fill", colorReplacementMap.get(normalizedColor));
      }
    }
    if (hasAttributeWithValue(elm, "stroke")) {
      let color = elm.getAttribute("stroke");
      let normalizedColor = normalizeColorValue(color);
      if (colorReplacementMap.has(normalizedColor)) {
        // console.log("replace stroke %s with %s", color, colorReplacementMap.get(normalizedColor));
        elm.setAttribute("stroke", colorReplacementMap.get(normalizedColor));
      }
    }
  });
  return doc;
}

function colorSwatchView(color) {
  return `<div class="color-swatch">
  <span class="color-preview" style="background-color: ${color}"></span>
  <span class="color-label">${color}</span></div>`;
}

function colorAssignmentView(color) {
  let swatch = colorSwatchView(color);
  let fillChecked =  color == "context-fill" ? "checked" : "";
  let strokeChecked =  color == "context-stroke" ? "checked" : "";
  let noneChecked = !(fillChecked || strokeChecked) ?  "checked" : "";

  return `<div class="color-assignment">
    ${swatch}
    <input type="checkbox" name="fill-assignment" ${fillChecked} value="${color}">
    <input type="checkbox" name="stroke-assignment" ${strokeChecked} value="${color}">
    <input type="checkbox" name="none-assignment" ${noneChecked} value="${color}">
  </div>`;
}

// ----------------------------------------

function loadInputImage() {
  let inputImg = document.getElementById("input-image");
  let params = new URLSearchParams(document.location.search.substring(1));
  console.log("URL params: ", params);
  if (params.has("src")) {
    inputImg.src = params.get("src");
  }
  // get and process the image data
  let src = inputImg.src;
  console.log("Using image: ", src);
  return fetch(src).then(resp => {
    return resp.text();
  }).then(content => {
    let parser = new DOMParser();
    return parser.parseFromString(content.toString(), "image/svg+xml");
  })
}

function getUniqueColorsFromDocument(doc) {
  let colorsFound = getColorsFromDocument(gInputDocument);
  let uniqueColors = new Set();
  for (let color of colorsFound) {
    let ncolor = color && normalizeColorValue(color);
    if (ncolor) {
      uniqueColors.add(ncolor);
    }
  }
  return uniqueColors;
}

function updateUI(colors) {
  let colorHtmls = [];
  for (let color of colors) {
    let html = colorSwatchView(color);
    colorHtmls.push(html);
  }
  document.getElementById("colors-found").insertAdjacentHTML("beforeend", colorHtmls.join("\n"));

  let assignmentHtmls = [];
  for (let color of colors) {
    let html = colorAssignmentView(color);
    assignmentHtmls.push(html);
  }
  document.getElementById("color-substitutes").insertAdjacentHTML("beforeend", assignmentHtmls.join("\n"));
}

function createOutputDocument(inputDocument) {
  let outputDocument = inputDocument.cloneNode(inputDocument, true);
  let replacements = new Map(substituteColors);
  let fillColor = substituteColors.get("context-fill");
  let strokeColor = substituteColors.get("context-stroke");
  let checkedSelector = "#color-substitutes .color-assignment input[type='checkbox']:checked";

  Array.from(document.querySelectorAll(checkedSelector)).forEach(input => {
    switch (input.name) {
      case "fill-assignment":
        replacements.set(input.value, fillColor);
        break;
      case "stroke-assignment":
        replacements.set(input.value, strokeColor);
        break;
      default:
        console.log("Leave color: %s as-is", input.value);
    }
  });
  replaceColorsInDocument(outputDocument, replacements);
  return outputDocument;
}

function renderOutput(outputDocument, dataURI) {
  if (!dataURI) {
    let svgString = outputDocument.documentElement.outerHTML;
    dataURI = "data:image/svg+xml;base64," +  btoa(svgString);
  }
  let outputContainer = document.querySelector("#output > .image-container");
  let outputImg = new Image();
  outputContainer.innerHTML = "";
  outputContainer.appendChild(outputImg);
  outputImg.src = dataURI;
}

function renderPreview(outputDocument, animationUrl) {
  if (!animationUrl) {
    let svgString = outputDocument.documentElement.outerHTML;
    animationUrl = "data:image/svg+xml;base64," +  btoa(svgString);
  }
  let dims = getAnimationDimensions(outputDocument.documentElement);
  console.log("getAnimationDimensions: ", dims);

  let previewInner = document.getElementById("preview-inner");
  let previewOuter = document.getElementById("preview-outer");
  previewOuter.style.width = dims.frameWidth + "px";
  previewOuter.style.height = dims.frameHeight + "px";
  previewInner.style.width = dims.animationWidth + "px";
  previewInner.style.height = dims.animationHeight + "px";

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

let SVG_SHAPES = {'rect': 1, 'path': 1, 'circle': 1, 'ellipse': 1, 'line': 1, 'polyline': 1, 'polygon': 1};

function hasColor(elm) {
  return (elm.localName in SVG_SHAPES) || elm.hasAttribute("fill") || elm.hasAttribute("stroke");
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
  if (match = str.trim().match(/\d+\%?/g)) {
    [red, green, blue, alpha] = Array.from(match).map(color => {
      if (color.endsWith("%")) {
        return 255 * Number(color.substring(0, color.length-1)) / 100;
      }
      return Number(color);
    });
  }

  if (alpha !== undefined) {
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
