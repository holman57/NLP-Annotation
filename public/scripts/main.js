labeled_vids = [];
storage_vids = [];
index = [];
labels = [];

let current_id = 0;
let position = 0;
let document_exists = true

let not_possible = false;
let possible = false;
let incomplete_scene = false;
let language_use = false;
let unknown = false;

const button_opacity = 0.5;
const border_style = 'inset';

const not_possible_button = document.querySelector('#not-possible');
const possible_button = document.querySelector('#possible');
const incomplete_scene_button = document.querySelector('#incomplete-scene');
const language_use_button = document.querySelector('#language-use');
const unknown_button = document.querySelector('#unknown');

const right_button = document.querySelector('#right');
const left_button = document.querySelector('#left');
const nav_position = document.querySelector('#position')

// --------------------------------------------------------------------- modal
const modal = document.getElementById("myModal");
const btn = document.getElementById("myBtn");
const span = document.getElementsByClassName("close")[0];
btn.onclick = function () {
    modal.style.display = "block";
}
span.onclick = function () {
    modal.style.display = "none";
}
window.onclick = function (event) {
    if (event.target === modal) {
        modal.style.display = "none";
    }
}
// -------------------------------------------------------------------------------------------

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Signs-in Friendly Chat.
function signIn() {
    // Sign in Firebase using popup auth and Google as the identity provider.
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
}

// Signs-out of Friendly Chat.
function signOut() {
    // Sign out of Firebase.
    firebase.auth().signOut();
}

// Initiate firebase auth.
function initFirebaseAuth() {
    // Listen to auth state changes.
    firebase.auth().onAuthStateChanged(authStateObserver);
}

// Returns the signed-in user's profile Pic URL.
function getProfilePicUrl() {
    return firebase.auth().currentUser.photoURL || '/images/profile_placeholder.png';
}

// Returns the signed-in user's display name.
function getUserName() {
    return firebase.auth().currentUser.displayName;
}

// Returns true if a user is signed-in.
function isUserSignedIn() {
    return !!firebase.auth().currentUser;
}

// Saves a new message on the Cloud Firestore.
function saveMessage(messageText) {
    // Add a new message entry to the Firebase database.
    return firebase.firestore().collection('messages').add({
        name: getUserName(),
        text: messageText,
        profilePicUrl: getProfilePicUrl(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function (error) {
        console.error('Error writing new message to Firebase Database', error);
    });
}

// Loads chat messages history and listens for upcoming ones.
function loadMessages() {
    // const container = document.createElement('div');
    // const div = container.firstChild;
    // div.setAttribute('id', id);
    // Create the query to load the last 12 messages and listen for new ones.
    const query = firebase.firestore().collection('messages').orderBy('timestamp', 'desc').limit(12);

    // Start listening to the query.
    query.onSnapshot(function (snapshot) {
        snapshot.docChanges().forEach(function (change) {
            if (change.type === 'removed') {
                deleteMessage(change.doc.id);
            } else {
                var message = change.doc.data();
                displayMessage(change.doc.id, message.timestamp, message.name,
                    message.text, message.profilePicUrl, message.imageUrl);
            }
        });
    });
}

// Saves a new message containing an image in Firebase.
// This first saves the image in Firebase storage.
function saveImageMessage(file) {
    // 1 - We add a message with a loading icon that will get updated with the shared image.
    firebase.firestore().collection('messages').add({
        name: getUserName(),
        imageUrl: LOADING_IMAGE_URL,
        profilePicUrl: getProfilePicUrl(),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function (messageRef) {
        // 2 - Upload the image to Cloud Storage.
        var filePath = firebase.auth().currentUser.uid + '/' + messageRef.id + '/' + file.name;
        return firebase.storage().ref(filePath).put(file).then(function (fileSnapshot) {
            // 3 - Generate a public URL for the file.
            return fileSnapshot.ref.getDownloadURL().then((url) => {
                // 4 - Update the chat message placeholder with the image’s URL.
                return messageRef.update({
                    imageUrl: url,
                    storageUri: fileSnapshot.metadata.fullPath
                });
            });
        });
    }).catch(function (error) {
        console.error('There was an error uploading a file to Cloud Storage:', error);
    });
}

// Saves the messaging device token to the datastore.
function saveMessagingDeviceToken() {
    firebase.messaging().getToken().then(function (currentToken) {
        if (currentToken) {
            console.log('Got FCM device token:', currentToken);
            // Saving the Device Token to the datastore.
            firebase.firestore().collection('fcmTokens').doc(currentToken)
                .set({uid: firebase.auth().currentUser.uid});
        } else {
            // Need to request permissions to show notifications.
            requestNotificationsPermissions();
        }
    }).catch(function (error) {
        console.error('Unable to get messaging token.', error);
    });
}

// Requests permissions to show notifications.
function requestNotificationsPermissions() {
    // console.log('Requesting notifications permission...');
    // firebase.messaging().requestPermission().then(function() {
    //   // Notification permission granted.
    //   saveMessagingDeviceToken();
    // }).catch(function(error) {
    //   console.error('Unable to get permission to notify.', error);
    // });
}

// Triggered when a file is selected via the media picker.
function onMediaFileSelected(event) {
    event.preventDefault();
    var file = event.target.files[0];

    // Clear the selection in the file picker input.
    imageFormElement.reset();

    // Check if the file is an image.
    if (!file.type.match('image.*')) {
        var data = {
            message: 'You can only share images',
            timeout: 2000
        };
        signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
        return;
    }
    // Check if the user is signed-in
    if (checkSignedInWithMessage()) {
        saveImageMessage(file);
    }
}

// Triggered when the send new message form is submitted.
function onMessageFormSubmit(e) {
    e.preventDefault();
    // Check that the user entered a message and is signed in.
    if (messageInputElement.value && checkSignedInWithMessage()) {
        saveMessage(messageInputElement.value).then(function () {
            // Clear message text field and re-enable the SEND button.
            resetMaterialTextfield(messageInputElement);
            toggleButton();
        });
    }
}

// Triggers when the auth state change for instance when the user signs-in or signs-out.
function authStateObserver(user) {
    if (user) { // User is signed in!
        // Get the signed-in user's profile pic and name.
        var profilePicUrl = getProfilePicUrl();
        var userName = getUserName();

        // Set the user's profile pic and name.
        userPicElement.style.backgroundImage = 'url(' + addSizeToGoogleProfilePic(profilePicUrl) + ')';
        userNameElement.textContent = userName;

        // Show user's profile and sign-out button.
        userNameElement.removeAttribute('hidden');
        userPicElement.removeAttribute('hidden');
        signOutButtonElement.removeAttribute('hidden');

        // Hide sign-in button.
        signInButtonElement.setAttribute('hidden', 'true');

        // We save the Firebase Messaging Device token and enable notifications.
        saveMessagingDeviceToken();
    } else { // User is signed out!
        // Hide user's profile and sign-out button.
        userNameElement.setAttribute('hidden', 'true');
        userPicElement.setAttribute('hidden', 'true');
        signOutButtonElement.setAttribute('hidden', 'true');

        // Show sign-in button.
        signInButtonElement.removeAttribute('hidden');
    }
}

// Returns true if user is signed-in. Otherwise false and displays a message.
function checkSignedInWithMessage() {
    // Return true if the user is signed in Firebase
    if (isUserSignedIn()) {
        return true;
    }

    // Display a message to the user using a Toast.
    var data = {
        message: 'You must sign-in first',
        timeout: 2000
    };
    signInSnackbarElement.MaterialSnackbar.showSnackbar(data);
    return false;
}

// Resets the given MaterialTextField.
function resetMaterialTextfield(element) {
    element.value = '';
    element.parentNode.MaterialTextfield.boundUpdateClassesHandler();
}

// Template for messages.
var MESSAGE_TEMPLATE =
    '<div class="message-container">' +
    '<div class="spacing"><div class="pic"></div></div>' +
    '<div class="message"></div>' +
    '<div class="name"></div>' +
    '</div>';

// Adds a size to Google Profile pics URLs.
function addSizeToGoogleProfilePic(url) {
    if (url.indexOf('googleusercontent.com') !== -1 && url.indexOf('?') === -1) {
        return url + '?sz=150';
    }
    return url;
}

// A loading image URL.
var LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

// Delete a Message from the UI.
function deleteMessage(id) {
    var div = document.getElementById(id);
    // If an element for that message exists we delete it.
    if (div) {
        div.parentNode.removeChild(div);
    }
}

function createAndInsertMessage(id, timestamp) {
    const container = document.createElement('div');
    container.innerHTML = MESSAGE_TEMPLATE;
    const div = container.firstChild;
    div.setAttribute('id', id);

    // If timestamp is null, assume we've gotten a brand new message.
    // https://stackoverflow.com/a/47781432/4816918
    timestamp = timestamp ? timestamp.toMillis() : Date.now();
    div.setAttribute('timestamp', timestamp);

    // figure out where to insert new message
    const existingMessages = messageListElement.children;
    if (existingMessages.length === 0) {
        messageListElement.appendChild(div);
    } else {
        let messageListNode = existingMessages[0];
        while (messageListNode) {
            const messageListNodeTime = messageListNode.getAttribute('timestamp');
            if (!messageListNodeTime) {
                throw new Error(
                    `Child ${messageListNode.id} has no 'timestamp' attribute`
                );
            }
            if (messageListNodeTime > timestamp) {
                break;
            }
            messageListNode = messageListNode.nextSibling;
        }
        messageListElement.insertBefore(div, messageListNode);
    }
    return div;
}

// Displays a Message in the UI.
function displayMessage(id, timestamp, name, text, picUrl, imageUrl) {
    var div = document.getElementById(id) || createAndInsertMessage(id, timestamp);

    // profile picture
    if (picUrl) {
        div.querySelector('.pic').style.backgroundImage = 'url(' + addSizeToGoogleProfilePic(picUrl) + ')';
    }

    div.querySelector('.name').textContent = name;
    var messageElement = div.querySelector('.message');

    if (text) { // If the message is text.
        messageElement.textContent = text;
        // Replace all line breaks by <br>.
        messageElement.innerHTML = messageElement.innerHTML.replace(/\n/g, '<br>');
    } else if (imageUrl) { // If the message is an image.
        var image = document.createElement('img');
        image.addEventListener('load', function () {
            messageListElement.scrollTop = messageListElement.scrollHeight;
        });
        image.src = imageUrl + '&' + new Date().getTime();
        messageElement.innerHTML = '';
        messageElement.appendChild(image);
    }
    // Show the card fading-in and scroll to view the new message.
    setTimeout(function () {
        div.classList.add('visible')
    }, 1);
    messageListElement.scrollTop = messageListElement.scrollHeight;
    messageInputElement.focus();
}

// Enables or disables the submit button depending on the values of the input
// fields.
function toggleButton() {
    if (messageInputElement.value) {
        submitButtonElement.removeAttribute('disabled');
    } else {
        submitButtonElement.setAttribute('disabled', 'true');
    }
}

//------------------------------------------------------------------------------------------------------------------
function toggleNotPossible() {
    if (not_possible) {
        resetLabelButtons();
        not_possible = false;
    } else {
        resetLabelButtons();
        not_possible = true;
    }
    resetLabelOpacity();
}

function togglePossible() {
    if (possible) {
        resetLabelButtons();
        possible = false;
    } else {
        resetLabelButtons();
        possible = true;
    }
    resetLabelOpacity();
}

function toggleIncompleteScene() {
    if (incomplete_scene) {
        resetLabelButtons();
        incomplete_scene = false;
    } else {
        resetLabelButtons();
        incomplete_scene = true;
    }
    resetLabelOpacity();
}

function toggleLanguageUse() {
    if (language_use) {
        resetLabelButtons();
        language_use = false;
    } else {
        resetLabelButtons();
        language_use = true;
    }
    resetLabelOpacity();
}

function toggleUnknown() {
    if (unknown) {
        resetLabelButtons();
        unknown = false;
    } else {
        resetLabelButtons();
        unknown = true;
    }
    resetLabelOpacity();
}

function resetLabelOpacity() {
    if (not_possible) {
        not_possible_button.style.opacity = 1;
        not_possible_button.style.borderStyle = border_style;
    }
    else {
        not_possible_button.style.opacity = button_opacity;
        not_possible_button.style.borderStyle = 'none';
    }
    if (possible) {
        possible_button.style.opacity = 1;
        possible_button.style.borderStyle = border_style;
    }
    else {
        possible_button.style.opacity = button_opacity;
        possible_button.style.borderStyle = 'none';
    }
    if (incomplete_scene) {
        incomplete_scene_button.style.opacity = 1;
        incomplete_scene_button.style.borderStyle = border_style;
    }
    else {
        incomplete_scene_button.style.opacity = button_opacity;
        incomplete_scene_button.style.borderStyle = 'none';
    }
    if (language_use) {
        language_use_button.style.opacity = 1;
        language_use_button.style.borderStyle = border_style;
    }
    else {
        language_use_button.style.opacity = button_opacity;
        language_use_button.style.borderStyle = 'none';
    }
    if (unknown) {
        unknown_button.style.opacity = 1;
        unknown_button.style.borderStyle = border_style;
    }
    else {
        unknown_button.style.opacity = button_opacity;
        unknown_button.style.borderStyle = 'none';
    }

    // Nav Right
    if (!not_possible && !possible && !incomplete_scene && !language_use && !unknown || position > 9)
        right_button.setAttribute('disabled', 'true');
    else right_button.removeAttribute('disabled');

    // Nav Left
    if (position > 0) left_button.removeAttribute('disabled');
    else left_button.setAttribute('disabled', 'true');
}

function print_position() {
    console.log("position    : " + position);
    console.log("index.length: " + index.length);
    console.log("current id  : " + current_id);
}

function getLabel() {
    if (not_possible) return "Not possible";
    if (possible) return "Possible";
    if (incomplete_scene) return "Incomplete scene";
    if (language_use) return "Language use";
    if (unknown) return "Unknown";
}

function resetLabelButtons() {
    not_possible = false;
    possible = false;
    incomplete_scene = false;
    language_use = false;
    unknown = false;
}

function checkIndexLabels(item) {
    if (item === "Not possible") not_possible = true;
    if (item === "Possible") possible = true;
    if (item === "Incomplete scene") incomplete_scene = true;
    if (item === "Language use") language_use = true;
    if (item === "Unknown") unknown = true;
}

//------------------------------------------------------------------------------------ Left / Right
function left() {
    position--;
    resetLabelButtons();
    checkIndexLabels(labels[position])
    console.log("label       : " + getLabel());
    nav_position.innerHTML = position.toString() + "/50";
    loadIndexVideo(index[position]);
    resetLabelOpacity();
}

function right() {
    if (position < 50) position++;
    if (position < index.length) {
        loadIndexVideo(index[position]);
        labels[position - 1] = getLabel();
        firebase.firestore().collection("videos").doc(current_id.toString()).set({
            id: current_id,
            label: getLabel()
        })
        resetLabelButtons();
        checkIndexLabels(labels[position])
        console.log("label       : " + getLabel());
    } else {
        if (position < 50) {
            storage_vids.pop(current_id);
            labeled_vids.push(current_id);
            labels.push(getLabel())
            firebase.firestore().collection("videos").doc(current_id.toString()).set({
                id: current_id,
                label: getLabel()
            })
            resetLabelButtons();
            getVideo();
        } else {
            try {
                storage_vids.pop(current_id);
                labeled_vids.push(current_id);
                labels.push(getLabel())
            } catch (e) {
            }
            firebase.firestore().collection("videos").doc(current_id.toString()).set({
                id: current_id,
                label: getLabel()
            })
            resetLabelButtons();
            document.querySelector('#display-source').src = "";
            const display_video = document.querySelector('#display-video');
            display_video.load();
            modal.style.display = "block";
        }
    }
    nav_position.innerHTML = position.toString() + "/50";
    resetLabelOpacity();
}

async function getVideo() {
    let rand_num = getRandomInt(0, storage_vids.length - 1);
    document_exists = true
    while (document_exists) {
        let docRef = firebase.firestore().collection("videos").doc(storage_vids[rand_num].toString());
        let get_doc = docRef.get().then(function(doc) {
            if (doc.exists) {
                console.log(storage_vids[rand_num].toString(), "Exists:", doc.data());
                storage_vids.pop(storage_vids[rand_num]);
                rand_num = getRandomInt(0, storage_vids.length - 1);
            }
            else {
                console.log(storage_vids[rand_num].toString(), "doesn't exist");
                document_exists = false;
            }
        }).catch(function(error) {
            console.log("Error getting document:", error);
        });
        await get_doc;
    }
    current_id = parseInt(storage_vids[rand_num]);
    index.push(current_id);
    const video = 'videos/' + storage_vids[rand_num].toString() + '.mp4';
    const storageRef = firebase.storage().ref();
    storageRef.child(video).getDownloadURL().then(function (url) {
        document.querySelector('#display-source').src = url;
        const display_video = document.querySelector('#display-video');
        display_video.load();
        display_video.play();
    }).catch(function (error) {});
    print_position()
}

function loadIndexVideo(id) {
    current_id = id;
    const video = 'videos/' + id.toString() + '.mp4';
    const storageRef = firebase.storage().ref();
    storageRef.child(video).getDownloadURL().then(function (url) {
        document.querySelector('#display-source').src = url;
        const display_video = document.querySelector('#display-video');
        display_video.load();
        display_video.play();
    }).catch(function (error) {
    });
    print_position()
}

async function checkLabels() {
    const labels = firebase.firestore().collection("videos").get().then(function (querySnapshot) {
        querySnapshot.forEach(function (doc) {
            labeled_vids[labeled_vids.length] = parseInt(doc.data().id);
        });
    });
    var storageRef = firebase.storage().ref("videos");
    const stor = storageRef.listAll().then(function (result) {
        result.items.forEach(function (item) {
            vid = parseInt(item.location.path.replace("videos/", "").replace(".mp4", ""));
            storage_vids[storage_vids.length] = vid;
        })
    });
    await labels;
    await stor;
    storage_vids = storage_vids.filter(function (el) {
        return labeled_vids.indexOf(el) < 0;
    });
}

//------------------------------------------------------------------------------------------------------------------
// Checks that the Firebase SDK has been correctly setup and configured.
function checkSetup() {
    if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
        window.alert('You have not configured and imported the Firebase SDK. ' +
            'Make sure you go through the codelab setup instructions and make ' +
            'sure you are running the codelab using `firebase serve`');
    }
}

// Checks that Firebase has been imported.
checkSetup();

// Shortcuts to DOM Elements.
var messageListElement = document.getElementById('messages');
var messageFormElement = document.getElementById('message-form');
var messageInputElement = document.getElementById('message');
var submitButtonElement = document.getElementById('submit');
var imageButtonElement = document.getElementById('submitImage');
var imageFormElement = document.getElementById('image-form');
var mediaCaptureElement = document.getElementById('mediaCapture');
var userPicElement = document.getElementById('user-pic');
var userNameElement = document.getElementById('user-name');
var signInButtonElement = document.getElementById('sign-in');
var signOutButtonElement = document.getElementById('sign-out');
var signInSnackbarElement = document.getElementById('must-signin-snackbar');

// Saves message on form submit.
messageFormElement.addEventListener('submit', onMessageFormSubmit);
signOutButtonElement.addEventListener('click', signOut);
signInButtonElement.addEventListener('click', signIn);

// Toggle for the button.
messageInputElement.addEventListener('keyup', toggleButton);
messageInputElement.addEventListener('change', toggleButton);

// Events for image upload.
imageButtonElement.addEventListener('click', function (e) {
    e.preventDefault();
    mediaCaptureElement.click();
});
mediaCaptureElement.addEventListener('change', onMediaFileSelected);

// initialize Firebase
initFirebaseAuth();

// TODO: Enable Firebase Performance Monitoring.
firebase.performance();

// loadMessages();
resetLabelOpacity();
checkLabels().then(function (){
    if (storage_vids.length > 0)
        getVideo();
})

