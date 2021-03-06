var _mvMatrix = mat4.create();
var _pMatrix = mat4.create();

var _mvMatrixStack = [];

var _shadersToLoad = ["standard-shader"];
var _shaderPrograms = [];
var _currentShaderProgram = null;
var _gl;
var _canvas;
var _lastTime = 0;
var _rSquare = 0.0;

var _keysDown = {};

var _cameraPos = {x: 0, y: 0, z:50.0};

var _space = [];
var _spaceRot = { x:0, y:0, z:0 };
var _spaceRotPerSecond = { x:0, y:0, z:0 };

/* Startup funciton to set up the canvas */
var main = function()
{
	init();
	tick();
}

var init = function()
{
	initCanvas();
	initGL();
	initShaders();
	generateSpace(30, 30, 30);
}

var initCanvas = function()
{
	_canvas = document.getElementById("gl_canvas");
	_canvas.width = window.innerWidth;
	_canvas.height = window.innerHeight;
}

var initGL = function()
{
	try
	{
		_gl = _canvas.getContext("experimental-webgl", {antialias: true});
		_gl.viewportWidth = _canvas.width;
		_gl.viewportHeight = _canvas.height;
		_gl.clearColor(0.0, 0.0, 0.0, 1.0);
        _gl.enable(_gl.DEPTH_TEST);
	}
	catch(e)
	{
		alert("Could not start WebGL: " + e);
		return false;
	}
	
	document.onkeydown = handleKeyDown;
	document.onkeyup = handleKeyUp;
}

var initShaders = function()
{
	for(var i = 0; i < _shadersToLoad.length; ++i)
	{
		var program = initShaderProgram(_shadersToLoad[i]);
		_shaderPrograms.push(program);
	}
	
	_currentShaderProgram = _shaderPrograms[0];
}

var getShader = function(shaderID)
{
	var shaderScript = document.getElementById(shaderID);
	if(!shaderScript)
	{
		console.error("Could not find shader script '" + shaderID + "'");
		return null;
	}
	
	var shaderScriptSource = "";
	var child = shaderScript.firstChild;
	while(child)
	{
		if(child.nodeType == 3)
		{
			shaderScriptSource = shaderScriptSource + child.textContent;
		}
		
		child = child.nextSibling;
	}
	
	var shader;
	switch(shaderScript.type)
	{
		case "x-shader/x-fragment":
			shader = _gl.createShader(_gl.FRAGMENT_SHADER);
			break;
		case "x-shader/x-vertex":
			shader = _gl.createShader(_gl.VERTEX_SHADER);
			break;
		default:
			console.error("Unknown shader type '" + shaderScript.type + "' for shader '" + shaderID + "'");
			return null;
	}
	
	_gl.shaderSource(shader, shaderScriptSource);
	_gl.compileShader(shader);
	
	if(!_gl.getShaderParameter(shader, _gl.COMPILE_STATUS))
	{
		console.error("Error compiling shader '" + shaderID + "': " + _gl.getShaderInfoLog(shader));
		return null;
	}
	
	return shader;
}

var initShaderProgram = function(shaderType)
{
	var fragmentShader = getShader(shaderType + "-fs");
	if(fragmentShader == null)
	{
		return null;
	}
	
	var vertexShader = getShader(shaderType + "-vs");
	if(fragmentShader == null)
	{
		return null;
	}
	
	var shaderProgram = _gl.createProgram();
	_gl.attachShader(shaderProgram, vertexShader);
	_gl.attachShader(shaderProgram, fragmentShader);
	_gl.linkProgram(shaderProgram);
	
	if(!_gl.getProgramParameter(shaderProgram, _gl.LINK_STATUS))
	{
		console.error("Could not initialise shaders for shader type '" + shaderType + "'");
	}
	
	_gl.useProgram(shaderProgram);
	
	shaderProgram.vertexPositionAttribute = _gl.getAttribLocation(shaderProgram, "aVertexPosition");
	_gl.enableVertexAttribArray(shaderProgram.vertexPositionAttribute);
	
	shaderProgram.vertexColorAttribute = _gl.getAttribLocation(shaderProgram, "aVertexColor");
    _gl.enableVertexAttribArray(shaderProgram.vertexColorAttribute);
	
	shaderProgram.pMatrixUniform = _gl.getUniformLocation(shaderProgram, "uPMatrix");
	shaderProgram.mvMatrixUniform = _gl.getUniformLocation(shaderProgram, "uMVMatrix");
	
	return shaderProgram;
}

function mvPushMatrix() {
	var copy = mat4.clone(_mvMatrix);
	_mvMatrixStack.push(copy);
}

function mvPopMatrix() {
	if (_mvMatrixStack.length == 0) {
		throw "Invalid popMatrix!";
	}
	_mvMatrix = _mvMatrixStack.pop();
}

function degToRad(degrees) {
	return degrees * Math.PI / 180;
}

function animate() {
	var timeNow = new Date().getTime();
	if (_lastTime != 0) {
		var elapsed = timeNow - _lastTime;
		_rSquare += (75 * elapsed) / 1000.0;
		
		_spaceRot.x += _spaceRotPerSecond.x * (elapsed / 1000.0);
		_spaceRot.y += _spaceRotPerSecond.y * (elapsed / 1000.0);
		_spaceRot.z += _spaceRotPerSecond.z * (elapsed / 1000.0);
	}
	_lastTime = timeNow;
}

function handleKeyDown(event)
{
	_keysDown[event.keyCode] = true;
}

function handleKeyUp(event)
{
	_keysDown[event.keyCode] = false;
}

var cubeFaceBuffers = function(cubeSize)
{
	var size = cubeSize / 2;
	var squareVertexPositionBuffer = _gl.createBuffer();
	_gl.bindBuffer(_gl.ARRAY_BUFFER, squareVertexPositionBuffer);
	vertices = [
		/* Front Face */
		size, size, size,
		-size, size, size,
		-size, -size, size,
		size, -size, size,
		size, size, size,
		
		/* Right Face */
		size, size, -size,
		size, -size, -size,
		size, -size, size,
		size, -size, -size,
		
		/* Back Face */
		-size, -size, -size,
		-size, size, -size,
		size, size, -size,
		-size, size, -size,
		
		/* Left Face */
		-size, size, size,
		-size, -size, size,
		-size, -size, -size
		];
	_gl.bufferData(_gl.ARRAY_BUFFER, new Float32Array(vertices), _gl.STATIC_DRAW);
	squareVertexPositionBuffer.itemSize = 3;
	squareVertexPositionBuffer.numItems = Math.round(vertices.length / 3);

	squareVertexColorBuffer = _gl.createBuffer();
	_gl.bindBuffer(_gl.ARRAY_BUFFER, squareVertexColorBuffer);
	colors = []
	for (var i=0; i < squareVertexPositionBuffer.numItems; i++) {
		colors = colors.concat([0.5, 0.5, 0.5, 1.0]);
	}
	_gl.bufferData(_gl.ARRAY_BUFFER, new Float32Array(colors), _gl.STATIC_DRAW);
	squareVertexColorBuffer.itemSize = 4;
	squareVertexColorBuffer.numItems = 4;
	
	_gl.bindBuffer(_gl.ARRAY_BUFFER, squareVertexPositionBuffer);
	_gl.vertexAttribPointer(_currentShaderProgram.vertexPositionAttribute, squareVertexPositionBuffer.itemSize, _gl.FLOAT, false, 0, 0);
	
	_gl.bindBuffer(_gl.ARRAY_BUFFER, squareVertexColorBuffer);
    _gl.vertexAttribPointer(_currentShaderProgram.vertexColorAttribute, squareVertexColorBuffer.itemSize, _gl.FLOAT, false, 0, 0);
	
	return { vBuffer: squareVertexPositionBuffer, cBuffer: squareVertexColorBuffer };
}

var drawCube = function(cubePos, cubeSize, cubeFaceBuffers)
{
	_gl.bindBuffer(_gl.ARRAY_BUFFER, cubeFaceBuffers.vBuffer);
	_gl.vertexAttribPointer(_currentShaderProgram.vertexPositionAttribute, cubeFaceBuffers.vBuffer.itemSize, _gl.FLOAT, false, 0, 0);
	
	_gl.bindBuffer(_gl.ARRAY_BUFFER, cubeFaceBuffers.cBuffer);
	_gl.vertexAttribPointer(_currentShaderProgram.vertexColorAttribute, cubeFaceBuffers.cBuffer.itemSize, _gl.FLOAT, false, 0, 0);

	var size = cubeSize / 2;
	mvPushMatrix();
		mat4.translate(_mvMatrix, _mvMatrix, [cubePos.x * cubeSize, cubePos.y * cubeSize, cubePos.z * cubeSize]);
		mvPushMatrix();
			_gl.uniformMatrix4fv(_currentShaderProgram.pMatrixUniform, false, _pMatrix);
			_gl.uniformMatrix4fv(_currentShaderProgram.mvMatrixUniform, false, _mvMatrix);
	
			_gl.drawArrays(_gl.LINE_STRIP, 0, cubeFaceBuffers.vBuffer.numItems);
		mvPopMatrix();
	mvPopMatrix();
}

function updateInput()
{
	if(_keysDown[65])
		_cameraPos.x -= 1.0;
	
	if(_keysDown[68])
		_cameraPos.x += 1.0;
	
	if(_keysDown[87])
		_cameraPos.z -= 1.0;
	
	if(_keysDown[83])
		_cameraPos.z += 1.0;
	
	if(_keysDown[69])
		_cameraPos.y += 1.0;
	
	if(_keysDown[81])
		_cameraPos.y -= 1.0;
		
	var maxRotPerSecond = 3;
	var addedRotPerSecond = 0.02;
	if(_keysDown[37])
	{
		if(_spaceRotPerSecond.y + addedRotPerSecond <= maxRotPerSecond)
		{
			_spaceRotPerSecond.y += addedRotPerSecond;
		}
	}
	
	if(_keysDown[39])
	{
		if(_spaceRotPerSecond.y - addedRotPerSecond >= -maxRotPerSecond)
			_spaceRotPerSecond.y -= addedRotPerSecond;
	}
	
	if(_keysDown[40])
	{
		if(_spaceRotPerSecond.x + addedRotPerSecond <= maxRotPerSecond)
		{
			_spaceRotPerSecond.x += addedRotPerSecond;
		}
	}
	
	if(_keysDown[38])
	{
		if(_spaceRotPerSecond.x - addedRotPerSecond >= -maxRotPerSecond)
			_spaceRotPerSecond.x -= addedRotPerSecond;
	}
}

function generateSpace(limitX, limitY, limitZ)
{
	var limX = Math.ceil(limitX / 2);
	var limY = Math.ceil(limitY / 2);
	var limZ = Math.ceil(limitZ / 2);
	
	for(var x = -limX; x < limX; ++x)
	{
		for(var y = -limY; y < limY; ++y)
		{
			for(var z = -limZ; z < limZ; ++z)
			{
				if(Math.random() > 0.99)
				{
					_space.push({x: x, y: y, z: z});
				}
			}
		}
	}
}

var drawScene = function()
{
	_gl.viewport(0, 0, _gl.viewportWidth, _gl.viewportHeight);
	_gl.clear(_gl.COLOR_BUFFER_BIT | _gl.DEPTH_BUFFER_BIT);
	
	mat4.perspective(_pMatrix, 45, _gl.viewportWidth / _gl.viewportHeight, 0.1, 100.0);
	mat4.identity(_mvMatrix);
	mat4.translate(_mvMatrix, _mvMatrix, [-_cameraPos.x, -_cameraPos.y, -_cameraPos.z]);
	
	mvPushMatrix();
	mat4.rotateX(_mvMatrix, _mvMatrix, _spaceRot.x);
	mat4.rotateY(_mvMatrix, _mvMatrix, _spaceRot.y);
	mat4.rotateZ(_mvMatrix, _mvMatrix, _spaceRot.z);
	
	var standardCubeFaceBuffers = cubeFaceBuffers(1);
	for(var i = 0; i < _space.length; i++)
	{
		drawCube(_space[i], 1, standardCubeFaceBuffers);
	}
	mvPopMatrix();
}

var tick = function()
{
	requestAnimFrame(tick);
	animate();
	updateInput();
	drawScene();
}