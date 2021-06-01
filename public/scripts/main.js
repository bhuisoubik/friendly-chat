var messageListElement = document.getElementById('message-box');
var messageFormElement = document.getElementById('message-form');
var messageInputElement = document.getElementById('message-text');
var submitButtonElement = document.getElementById('btn-send');
var imageButtonElement = document.getElementById('btn-send-image');
var imageSelectFormElement = document.getElementById("image-form");
var mediaCaptureElement = document.getElementById('mediaCapture');
var userPicElement = document.getElementById('userpic');
var userNameElement = document.getElementById('username');
var signButtonElement = document.getElementById('btn-sign');

var LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

/*
|==================|
|  FIREBASE:START  |
|==================|
*/

var firebaseConfig = {
    "projectId": "friendlychat-a5452",
    "appId": "1:384698700525:web:7bf7a786de35983dccb2e4",
    "storageBucket": "friendlychat-a5452.appspot.com",
    "locationId": "us-central",
    "apiKey": "AIzaSyCfEgvGcpmToLWYNJk2R2CQyFE9-3V6vKc",
    "authDomain": "friendlychat-a5452.firebaseapp.com",
    "messagingSenderId": "384698700525",
    "measurementId": "G-VQVZSMTSS2"
}

firebase.initializeApp(firebaseConfig);
// Signs-in Friendly Chat.
function signIn() {
    // Sign into Firebase using popup auth & Google as the identity provider.
    var provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
    authStateObserver(true)
}

// Signs-out of Friendly Chat.
function signOut() {
    // Sign out of Firebase.
    firebase.auth().signOut();
    authStateObserver(false);
}

// Initiate Firebase Auth.
function initFirebaseAuth() {
    // Listen to auth state changes.
    firebase.auth().onAuthStateChanged(authStateObserver);
}

// Returns the signed-in user's profile pic URL.
function getProfilePicUrl() {
    if(firebase.auth().currentUser == null) {
        return '/images/guest_logo.png';
    }
    return firebase.auth().currentUser.photoURL
}
  
// Returns the signed-in user's display name.
function getUserName() {
    if (firebase.auth().currentUser == null) {
        return "Guest";
    }
    return firebase.auth().currentUser.displayName;
}

function isUserSignedIn() {
    return !!firebase.auth().currentUser;
}

// Saves a new message to your Cloud Firestore database.
function saveMessage(messageText) {
    // Add a new message entry to the database.
    return firebase.firestore().collection('messages').add({
      name: getUserName(),
      text: messageText,
      profilePicUrl: getProfilePicUrl(),
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).catch(function(error) {
      console.error('Error writing new message to database', error);
    });
}

function loadMessages() {
  // Create the query to load the last 12 messages and listen for new ones.
  var query = firebase.firestore()
                  .collection('messages')
                  .orderBy('timestamp', 'desc')
                  .limit(12);
  
  // Start listening to the query.
  query.onSnapshot(function(snapshot) {
    snapshot.docChanges().forEach(function(change) {
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

function saveImageMessage(file) {
  // 1 - We add a message with a loading icon that will get updated with the shared image.
  firebase.firestore().collection('messages').add({
    name: getUserName(),
    imageUrl: LOADING_IMAGE_URL,
    profilePicUrl: getProfilePicUrl(),
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function(messageRef) {
    // 2 - Upload the image to Cloud Storage.
    var filePath = firebase.auth().currentUser.uid + '/' + messageRef.id + '/' + file.name;
    return firebase.storage().ref(filePath).put(file).then(function(fileSnapshot) {
      // 3 - Generate a public URL for the file.
      return fileSnapshot.ref.getDownloadURL().then((url) => {
        // 4 - Update the chat message placeholder with the image's URL.
        return messageRef.update({
          imageUrl: url,
          storageUri: fileSnapshot.metadata.fullPath
        });
      });
    });
  }).catch(function(error) {
    console.error('There was an error uploading a file to Cloud Storage:', error);
  });
}


function onMediaFileSelected(event) {
  event.preventDefault();
  var file = event.target.files[0];

  // Clear the selection in the file picker input.
  imageSelectFormElement.reset();

  // Check if the file is an image.
  if (!file.type.match('image.*')) {
    var data = {
      message: 'You can only share images',
      timeout: 2000,
    };
    alert(data);
    return;
  }
  // Check if the user is signed-in
  if (checkSignedInWithMessage()) {
    saveImageMessage(file);
  }
}

// Saves the messaging device token to the datastore.
function saveMessagingDeviceToken() {
  firebase.messaging().getToken().then(function(currentToken) {
    if (currentToken) {
      console.log('Got FCM device token:', currentToken);
      // Saving the Device Token to the datastore.
      firebase.firestore().collection('fcmTokens').doc(currentToken)
          .set({uid: firebase.auth().currentUser.uid});
    } else {
      // Need to request permissions to show notifications.
      requestNotificationsPermissions();
    }
  }).catch(function(error){
    console.error('Unable to get messaging token.', error);
  });
}

// Requests permission to show notifications.
function requestNotificationsPermissions() {
  console.log('Requesting notifications permission...');
  firebase.messaging().requestPermission().then(function() {
    // Notification permission granted.
    saveMessagingDeviceToken();
  }).catch(function(error) {
    console.error('Unable to get permission to notify.', error);
  });
}

/*
|================|
|  FIREBASE:END  |
|================|
*/

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
    alert(data);
    return false;
}

function toggleButton() {
    if (messageInputElement.value) {
      submitButtonElement.removeAttribute('disabled');
    } else {
      submitButtonElement.setAttribute('disabled', 'true');
    }
}

function resetMaterialTextfield(element) {
    element.value = '';
}

// Delete a Message from the UI.
function deleteMessage(id) {
  var div = document.getElementById(id);
  // If an element for that message exists we delete it.
  if (div) {
    div.parentNode.removeChild(div);
  }
}

function onMessageFormSubmit(e) {
    e.preventDefault();
    // Check that the user entered a message and is signed in.
    if (messageInputElement.value && checkSignedInWithMessage()) {
      saveMessage(messageInputElement.value).then(function() {
        // Clear message text field and re-enable the SEND button.
        deleteMessage(messageListElement.lastChild.getAttribute("id"))
        resetMaterialTextfield(messageInputElement);
        toggleButton();
      });
    }
    
}

function createAndInsertMessage(id, timestamp, name, text, profilePic, imageUrl) {
  var div = document.createElement('div');
  var MESSAGE_SEND_TEMPLATE = ``

  var MESSAGE_RECIEVE_TEMPLATE = ``

  if(imageUrl) {
    MESSAGE_SEND_TEMPLATE = `<div class="msg-send">
    <div>
        <img src="${profilePic}" width="30" height="30">
        <h4>${name}</h4>
    </div>
        <img src="${imageUrl}" width="220" height="200" class="img">
    </div>`;

    var MESSAGE_RECIEVE_TEMPLATE = `<div class="msg-recieve">
    <div>
      <img src="${profilePic}" width="30" height="30">
      <h4>${name}</h4>
    </div>
        <img src="${imageUrl}" width="220" height="200" class="img">
    </div>`
  } else if (text) {
    MESSAGE_SEND_TEMPLATE = `<div class="msg-send">
  <div>
      <img src="${profilePic}" width="30" height="30">
      <h4>${name}</h4>
  </div>
    <p>${text}</p>
  </div>`

  MESSAGE_RECIEVE_TEMPLATE = `<div class="msg-recieve">
  <div>
    <img src="${profilePic}" width="30" height="30">
    <h4>${name}</h4>
  </div>
    <p>${text}</p>
  </div>`
  }

  if(name == getUserName()){
    div.innerHTML = MESSAGE_SEND_TEMPLATE
  } else {
    div.innerHTML = MESSAGE_RECIEVE_TEMPLATE
  }

  div.setAttribute("id", id)
  timestamp = timestamp ? timestamp.toMillis() : Date.now();
  div.setAttribute("timestamp", timestamp);

    messageListElement.appendChild(div)
    var sort_by_timestamp = function(a, b) {
      return a.getAttribute("timestamp").localeCompare(b.getAttribute("timestamp"))
    }
    var ls = Array.from(messageListElement.children).sort(sort_by_timestamp);

    while (messageListElement.children.length != 0) {
      messageListElement.removeChild(messageListElement.lastChild);
    }

    for(var i = 0; i < ls.length; i++) {
      messageListElement.appendChild(ls[i])
    }
  return div;
}

function displayMessage(id, timestamp, name, text, picUrl, imageUrl) {
  var div = document.getElementById(id)
  if(div == null) {
    createAndInsertMessage(id, timestamp, name, text, picUrl, imageUrl)
  } else {
    if(imageUrl){
      document.querySelector(`#${id} div .img`).setAttribute("src", imageUrl)
    }
  }
}

function authStateObserver(user) {
    if(user) {
        userPicElement.setAttribute("src",getProfilePicUrl())
        userNameElement.innerHTML = getUserName();
        signButtonElement.innerHTML = "Sign Out";
        signButtonElement.setAttribute("onclick", "signOut()");

        saveMessagingDeviceToken();
    } else {
        userPicElement.setAttribute("src", "./images/guest_logo.png")
        userNameElement.innerHTML = "Guest";
        signButtonElement.innerHTML = "Sign Up";
        signButtonElement.setAttribute("onclick", "signIn()");
    } 
}

function checkSetup() {
  if (!window.firebase || !(firebase.app instanceof Function) || !firebase.app().options) {
    window.alert('You have not configured and imported the Firebase SDK. ' +
        'Make sure you go through the codelab setup instructions and make ' +
        'sure you are running the codelab using `firebase serve`');
  }
}

// Checks that Firebase has been imported.
checkSetup();

submitButtonElement.addEventListener("click", onMessageFormSubmit)

messageInputElement.addEventListener('keyup', toggleButton);
messageInputElement.addEventListener('change', toggleButton);

// Events for image upload.
imageButtonElement.addEventListener('click', function(e) {
  e.preventDefault();
  mediaCaptureElement.click();
});
mediaCaptureElement.addEventListener('change', onMediaFileSelected);

initFirebaseAuth()

firebase.performance();

loadMessages()