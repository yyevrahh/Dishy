import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDvXage0SbYUMV8RFZzn48ANw4GX_D6Zfo",
  authDomain: "dishy-280a7.firebaseapp.com",
  projectId: "dishy-280a7",
  storageBucket: "dishy-280a7.firebasestorage.app",
  messagingSenderId: "785622443437",
  appId: "1:785622443437:web:acbe9c5813fb60be0c2d24",
  measurementId: "G-N3X5D4SQ58"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

var logoutButton = document.querySelector('.logoutButton');

let userId = null;

onAuthStateChanged(auth, (user) => {
	if (user) {
		userId = user.uid;
		console.log("User " + user.displayName + " in add-recipe.");
		console.log("User ID: " + userId);
	} else {
		console.log("No user is signed in.");
		window.location.href = "../";
	}
});

logoutButton.addEventListener('click', () => {
	signOut(auth)
		.then(() => {
			console.log("User logged out successfully.");
			window.location.href = "../";
		})
		.catch((error) => {
			console.error("Error logging out:", error);
		});
});

let ingredients = [];

$("#add.ingredient").click(function() {

	if($("#ingredient").val() != '') {
		var ingredient = $("#ingredient").val();
		ingredients.push(ingredient);
		displayIngredients(ingredients);
		$("#ingredient").val('');
	}
	else {
		alert('Please enter an ingredient');
	}
	
	console.log(ingredients);

});

function displayIngredients(ingredients) {

    const ingredientsList = $('.ingredients-list');

    ingredientsList.empty();

    ingredients.forEach((ingredient, index) => {
        const ingredientItem = $('<div>').addClass('ingredient-item');

        const ingredientName = $('<div>').addClass('ingredient-name').text(ingredient);
        const deleteBtn = $('<div>').addClass('delete').text('X');

        ingredientItem.append(ingredientName).append(deleteBtn);
        ingredientsList.append(ingredientItem);

        deleteBtn.on('click', function() {
            ingredients.splice(index, 1);
            displayIngredients(ingredients);
        });
    });
	
}

let procedures = [];

$("#add.procedure").click(function() {

	if($("#procedure").val() != '') {
		var procedure = $("#procedure").val();
		procedures.push(procedure);
		displayProcedures(procedures);
		$("#procedure").val('');
	}
	else {
		alert('Please enter a procedure');
	}
	
	console.log(procedures);

});

function displayProcedures(procedures) {

    const proceduresList = $('.procedures-list');

    proceduresList.empty();

    procedures.forEach((procedure, index) => {
        const procedureItem = $('<div>').addClass('procedure-item');

        const procedureName = $('<div>').addClass('procedure-name').text(procedure);
        const deleteBtn = $('<div>').addClass('delete').text('X');

        procedureItem.append(procedureName).append(deleteBtn);
        proceduresList.append(procedureItem);

        deleteBtn.on('click', function() {
            procedures.splice(index, 1);
			displayProcedures(procedures)
        });
    });
	
}

$(".save").click(async function () {
    const dishName = $("#dishName").val();
    const flavor = $("#flavor").val();
    const difficulty = $("#difficulty").val();
    const token = turnstile.getResponse();

    if (!token) {
        alert("Please complete the CAPTCHA.");
        return;
    }

    if (dishName && flavor && ingredients.length > 0 && procedures.length > 0) {
        try {
            const verificationResponse = await fetch("/api/verify-turnstile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: token }),
            });

            const verificationData = await verificationResponse.json();

            if (!verificationData.success) {
                alert("CAPTCHA verification failed. Please try again.");
                return;
            }

            await addDoc(collection(db, "recipes"), {
                userId: userId,
                dishName: dishName,
                flavor: flavor,
                ingredients: ingredients,
                procedures: procedures,
                difficulty: difficulty,
                createdAt: new Date(),
            });
            $(".text-input").val("");
            $("input").text("");
            $("#difficulty").val("easy");
            ingredients = [];
            procedures = [];
            displayIngredients(ingredients);
            displayProcedures(procedures);

            $("#popup").fadeIn();
        } catch (e) {
            console.error("Error adding document: ", e);
            alert("Error saving recipe");
        }
    } else {
        alert("Please fill in all fields!");
    }
});

$("#closePopup").click(function () {
    $("#popup").fadeOut();
});

