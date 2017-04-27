function makeSpriteSheet(animationData, options) {
  console.log('makeSpriteSheet with: ', animationData, options);
  var outputSize = options.outputSize;
  var cropMargins = options.cropMargins || {};

  var width = animationData.w;
  var height = animationData.h;

  var croppedWidth = width - (cropMargins.left || 0) - (cropMargins.right || 0);
  var croppedHeight = height - (cropMargins.top || 0) - (cropMargins.bottom || 0);
  var scaleX = outputSize.width / croppedWidth;
  var scaleY = outputSize.height / croppedHeight;
  var uncroppedOutputSize = {
    width: width * scaleX,
    height: height * scaleY
  };
  var outputCropOffset = {
    x: -(cropMargins.left || 0) * scaleX,
    y: -(cropMargins.top || 0) * scaleY,
  };

  var wrapper = document.createElement('div');
  var anim = bodymovin.loadAnimation({
    wrapper: wrapper,
    animType: 'svg',
    loop: true,
    autoplay: false,
    prerender: false,
    animationData: animationData,
  });

  var frameCount = Math.max(30, anim.totalFrames);
  console.log('frameCount: ', anim.totalFrames);
  var frameRate = anim.frameRate;

  function adjustHashURL(value, prefix) {
    if (value.startsWith('url(#')) {
      var hash = value.substring('url(#'.length, value.length - 1);
      return 'url(#' + prefix + hash + ')';
    }
    return value;
  }

  function makeUnique(node, prefix) {
    if (node.id) {
      node.id = prefix + node.id;
    }
    if (node.getAttribute('filter')) {
      node.setAttribute('filter', adjustHashURL(node.getAttribute('filter'), prefix));
    }
    if (node.getAttribute('mask')) {
      node.setAttribute('mask', adjustHashURL(node.getAttribute('mask'), prefix));
    }
    if (node.getAttribute('clip-path')) {
      node.setAttribute('clip-path', adjustHashURL(node.getAttribute('clip-path'), prefix));
    }
    for (var i = 0; i < node.childNodes.length; i++) {
      makeUnique(node.childNodes[i], prefix);
    }
  }

  var doc = document.implementation.createDocument("", "", null);
  var output = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  output.setAttribute('width', frameCount * outputSize.width);
  output.setAttribute('height', outputSize.height);
  doc.appendChild(output);

  for (var i = 0; i <= frameCount; i++) {
    anim.goToAndStop(i, true);
    var svgNode = wrapper.firstElementChild.cloneNode(true);
    makeUnique(svgNode, 'f' + i + '_');
    svgNode.setAttribute('x', i * outputSize.width + outputCropOffset.x);
    svgNode.setAttribute('y', outputCropOffset.y);
    svgNode.setAttribute('width', uncroppedOutputSize.width);
    svgNode.setAttribute('height', uncroppedOutputSize.height);
    output.appendChild(svgNode);
  }

  var serializer = new XMLSerializer();
  var str = serializer.serializeToString(doc);

  return {
    spriteSheet: {
      width: frameCount * outputSize.width,
      height: outputSize.height,
      str: str,
      dataURL: 'data:image/svg+xml;base64,' + btoa(str)
    },
    animationKeyframes: {
      transform: [ 'translateX(0px)', 'translateX(' + -((frameCount - 1) * outputSize.width) + 'px)']
    },
    animationOptions: {
      duration: frameCount / frameRate * 1000,
      easing: 'steps(' + (frameCount - 1) + ')',
      fill: 'forwards',
    }
  }
}
