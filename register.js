// Ensure you have these imports at the top of your register.js file
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

export async function registerUser(auth, db, name, email, phone, password, confirmPassword) {
    const errorMessageElement = document.getElementById('errorMessage');
    const registerButton = document.getElementById('registerButton');
    errorMessageElement.textContent = '';
    
    // (Validation logic goes here, omitted for brevity)
    if (password !== confirmPassword) {
        errorMessageElement.textContent = 'Passwords do not match.';
        return;
    }

    registerButton.disabled = true;
    registerButton.textContent = 'Processing...';

    try {
        // PART 1: AUTHENTICATION
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log("User created in Firebase Auth. UID:", user.uid);

        // PART 2: FIRESTORE DATA WRITE
        // This creates a document in the 'users' collection, using the unique user.uid as the document ID
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            phone: phone,
            createdAt: new Date().toISOString()
        });

        console.log('Registration complete. Data saved to Firestore.');
        
        // Success: Redirect
        // window.location.href = 'index.html';
        
    } catch (error) {
        // If an error occurs, check the console for the error.code 
        // (e.g., auth/email-already-in-use or firestore/permission-denied)
        console.error('Registration Error:', error);
        
        let message = error.message;

        if (error.code === 'auth/email-already-in-use') {
            message = 'This email is already registered.';
        } else if (error.code === 'firestore/permission-denied') {
            message = 'Data save failed. **Check your Firestore Security Rules!**';
        }
        
        errorMessageElement.textContent = message;

    } finally {
        registerButton.disabled = false;
        registerButton.textContent = 'Register';
    }
}