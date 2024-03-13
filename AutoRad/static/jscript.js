var globalMaskClassPaths = [];
var structureLayers = [];
var mask_path;

/**
 * Image upload image function
 */
function handleImageUpload() {
    var imageInput = document.getElementById('imageUpload');
    var submitButton = document.getElementById('submitImage');
    
    if (imageInput.files && imageInput.files[0]) {
        // Enable the submit button
        submitButton.disabled = false;
        
        // Display the uploaded image
        displayUploadedImage();
    } else {
        // Disable the submit button if no image is chosen
        submitButton.disabled = true;
        
    }
}

/**
 * Display upload image function
 */
function displayUploadedImage() {
    var input = document.getElementById('imageUpload');
    var editButton = document.getElementById('editImage');
    // var overlayBtn = document.getElementById('processIamge')
    if (input.files && input.files[0]) {
        var reader = new FileReader();

        reader.onload = function(e) {
            $('#imagePlaceholder1').attr('src', e.target.result);
            $('#imageOrigin').attr('src', e.target.result);
        }

        reader.readAsDataURL(input.files[0]);
        editButton.disabled = false
        // overlayBtn.disabled = false;
    }
    else {
        editButton.disabled = true
        // overlayBtn.disabled = true;
    }
}

function getCSRFToken() {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
        var cookie = jQuery.trim(cookies[i]);
        if (cookie.substring(0, 'csrftoken'.length + 1) === 'csrftoken=') {
            return decodeURIComponent(cookie.substring('csrftoken'.length + 1));
        }
    }
    return null;
}

function processCanvasImage() {
    var canvas1 = document.getElementById('annotation-canvas1');
    var canvas2 = document.getElementById('annotation-canvas2');
    var ctx1 = canvas1.getContext('2d');
    var ctx2 = canvas2.getContext('2d');

    console.log(ctx2);


    var imageData = ctx2.getImageData(0, 0, canvas2.width, canvas2.height);

    // Define the color information for the structures
    var structureColors = {
        IVD: [64, 64, 64, 255], // Note: Alpha is out of 255 here
        PE: [128, 128, 128, 255],
        TS: [192, 192, 192, 255],
        AAP: [255, 255, 255, 255]
    };

    // Function to identify structure based on the clicked color
    function identifyStructure(pixel) {
        for (var structure in structureColors) {
            if (structureColors.hasOwnProperty(structure)) {
                var color = structureColors[structure];
                if (pixel[0] === color[0] && pixel[1] === color[1] && pixel[2] === color[2] && pixel[3] === color[3]) {
                    return structure;
                }
            }
        }
        return "Unknown Structure";
    }

    function findMatchingPixels(imageData, targetColor) {
        let pixels = imageData.data;
        let width = imageData.width;
        let matchingPixels = [];

        for (let i = 0; i < pixels.length; i += 4) {
            let r = pixels[i];
            let g = pixels[i + 1];
            let b = pixels[i + 2];
            let a = pixels[i + 3];

            // Check if the current pixel matches the target color
            if (r === targetColor[0] && g === targetColor[1] && b === targetColor[2] && a === targetColor[3]) {
                let x = (i / 4) % width;
                let y = Math.floor((i / 4) / width);
                matchingPixels.push({ x, y });
            }
        }

        return matchingPixels;
    }

    function computeBoundingBox(points) {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        points.forEach(point => {
            if (point.x < minX) minX = point.x;
            if (point.x > maxX) maxX = point.x;
            if (point.y < minY) minY = point.y;
            if (point.y > maxY) maxY = point.y;
        });

        return {
            topLeft: { x: minX, y: minY },
            bottomRight: { x: maxX, y: maxY }
        };
    }


    Object.keys(structureColors).forEach(function (structure) {
        var color = structureColors[structure];
        var matchingPixels = findMatchingPixels(imageData, color);
        var boundingBox = computeBoundingBox(matchingPixels);

        console.log(matchingPixels);

        // If you want to draw a bounding box for each structure
        var rect = new fabric.Rect({
            left: boundingBox.topLeft.x,
            top: boundingBox.topLeft.y,
            width: boundingBox.bottomRight.x - boundingBox.topLeft.x,
            height: boundingBox.bottomRight.y - boundingBox.topLeft.y,
            fill: 'rgba(0,0,0,0)', // transparent fill
            stroke: 'red',
            strokeWidth: 2,
            selectable: true // If you don't want it to be selectable
        });

        // Add the rectangle to the fabric canvas
        canvas2.add(rect);
    });

    canvas2.renderAll();

}



function overlayImage() {
    var canvas1 = document.getElementById('annotation-canvas1');
    var canvas2 = document.getElementById('annotation-canvas2');
    var ctx1 = canvas1.getContext('2d');
    var ctx2 = canvas2.getContext('2d');
    var mriImage = new Image();
    var mask = new Image();
    // Clear the canvas before drawing new images
    ctx1.clearRect(0, 0, canvas1.width, canvas1.height);
    ctx2.clearRect(0, 0, canvas2.width, canvas2.height);

    // Load and draw the MRI image first
    mriImage.onload = function() {
        canvas1.width = mriImage.width;
        canvas1.height = mriImage.height;
        canvas2.width = mriImage.width;
        canvas2.height = mriImage.height;

        ctx1.drawImage(mriImage, 0, 0);

        ctx1.globalAlpha = 0.5;
        ctx1.drawImage(mask, 0, 0);
        ctx1.globalAlpha = 1.0;
        ctx2.drawImage(mask, 0, 0);



    };

    // Set the source of the MRI image
    mriImage.src = $('#imagePlaceholder1').attr('src');
    mask.src = mask_path;

    processCanvasImage();
}


/**
 * This function will upload the image to the model and generate the output png files in media folder 
 */
function uploadImage() {
    var formData = new FormData();
    formData.append('image', $('#imageUpload')[0].files[0]);
    var csrftoken = getCSRFToken();

    $.ajax({
        type: 'POST',
        url: '/api/process-image/',
        data: formData,
        processData: false,
        contentType: false,
        beforeSend: function(xhr) {
            if (csrftoken) {
                xhr.setRequestHeader("X-CSRFToken", csrftoken);
            }
        },
        success: function(response) {
            // Extract relevant data from the response
            var maskUrl = response.mask_url;
            // Second API call: view_mask
            $.ajax({
                type: 'POST',
                url: '/api/view-mask/',
                data: { 'mask_url': maskUrl },  // Pass relevant data to the second API
                success: function(viewMaskResponse) {
                    // Handle the response of the second API as needed
                    $('#imagePlaceholder2').attr('src', viewMaskResponse.mask_url)
                    globalMaskClassPaths = viewMaskResponse.mask_class_paths;
                    mask_path = viewMaskResponse.mask_url;
                    processImages()
                    // addBKGtoCanvas()
                },
                error: function() {
                    console.error('Error calling view_mask API');
                }
            });
        },
        error: function() {
            console.error('Error processing image');
        }
    });
}


function processImages() {
    $('#imageIVD').attr('src', globalMaskClassPaths[0])
    $('#imagePE').attr('src', globalMaskClassPaths[1])
    $('#imageTS').attr('src', globalMaskClassPaths[2])
    $('#imageAAP').attr('src', globalMaskClassPaths[3])
}

/**
 * Reset Btn corresponding image's layer.
 * @param {*} btnObj 
 */
function resetBtn(btnObj) {
    if (btnObj.value == "IVD") {$('#imageIVD').attr('src', globalMaskClassPaths[0])}
    if (btnObj.value == "PE") {$('#imagePE').attr('src', globalMaskClassPaths[1])}
    if (btnObj.value == "TS") {$('#imageTS').attr('src', globalMaskClassPaths[2])}
    if (btnObj.value == "AAP") {$('#imageAAP').attr('src', globalMaskClassPaths[3])}
    alert(btnObj.value + " Image reset!")
}

/**
 * This function will make sure there is only one checkbox is selected under the selected elementName.
 * @param {*} checkbox This is a html checkbox element
 */
function onlyOne(checkbox) {
    var checkboxes = document.getElementsByName('typeCheck')
    checkboxes.forEach((item) => {
        if (item !== checkbox) {
            item.checked = false
            document.getElementById("resetBtn" + item.value).disabled = true
            document.getElementById("image" + item.value).hidden = true
            document.getElementById("hideBtn" + item.value).disabled = true
            document.getElementById("resetPos" + item.value).disabled = true
            // centerPos(item)
        }
    })
    if (checkbox.checked) {
        document.getElementById("resetBtn" + checkbox.value).disabled = false
        document.getElementById("image" + checkbox.value).hidden = false
        document.getElementById("hideBtn" + checkbox.value).disabled = false
        document.getElementById("resetPos" + checkbox.value).disabled = false
        // hideLayer(checkbox)
    } else {
        document.getElementById("resetBtn" + checkbox.value).disabled = true
        document.getElementById("image" + checkbox.value).hidden = true
        document.getElementById("hideBtn" + checkbox.value).disabled = true
        document.getElementById("resetPos" + checkbox.value).disabled = true
        // centerPos(checkbox)
    }
}

function selectStructure(event) {
    var x = event.offsetX;
    var y = event.offsetY;

    // Check each layer to find which one is selected
    for (var i = 0; i < structureLayers.length; i++) {
        var layer = structureLayers[i];
        var pixelData = ctx.getImageData(x, y, 1, 1).data;

        // Check if the clicked pixel is not transparent in this layer
        if (pixelData[3] !== 0) {
            console.log('Structure selected: Layer ' + layer.index);
            highlightStructure(layer.index);
            break; // Stop checking after the first match
        }
    }
}

function highlightStructure(selectedIndex) {
    // Clear the canvas and redraw everything
    // Highlight the selected structure in some way
    // Your logic for highlighting the selected structure goes here
}
