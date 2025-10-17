import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged, setPersistence, inMemoryPersistence } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, collection, query, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global instances
let app, auth, db, userId = null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// Your hardcoded Firebase Configuration (from your SDK)
const FIREBASE_CONFIG = {
       apiKey: "AIzaSyD73N_2NxY4_VQhy89khGKIgPVWuhSHw3Q",
       authDomain: "mysa-77a83.firebaseapp.com",
       projectId: "mysa-77a83",
       storageBucket: "mysa-77a83.firebaseapp.com",
       messagingSenderId: "199990845419",
       appId: "1:199990845419:web:2f7feaee3c05854a4303ae",
       measurementId: "G-0CE4KL8XE0"
    };

/**
 * Initializes Firebase, sets persistence, and authenticates the user.
 * @param {Function} onReadyCallback - Called when the user ID is established.
 */
export async function initializeFirebase(onReadyCallback) {
    let firebaseConfig;
    
    // Use environment config if available, otherwise use the fallback
    if (typeof __firebase_config !== 'undefined') {
        try {
            firebaseConfig = JSON.parse(__firebase_config);
        } catch (e) {
            console.error("Error parsing __firebase_config, falling back to hardcoded config.", e);
            firebaseConfig = FALLBACK_FIREBASE_CONFIG;
        }
    } else {
        firebaseConfig = FALLBACK_FIREBASE_CONFIG;
    }

    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        
        // CRITICAL FIX: Set persistence to inMemory for iframe environments
        await setPersistence(auth, inMemoryPersistence);

        if (typeof __initial_auth_token !== 'undefined') {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
        
        onAuthStateChanged(auth, (user) => {
            if (user) {
                userId = user.uid;
                console.log("Firebase initialized. User ID:", userId);
            } else {
                userId = crypto.randomUUID(); // Fallback ID for non-authenticated state
                console.log("Anonymous sign-in complete. Using ID:", userId);
            }
            onReadyCallback(db, userId);
        });

    } catch (error) {
        console.error("Error initializing Firebase:", error);
        // Fallback for user ID even on error to allow un-saved chat
        userId = crypto.randomUUID(); 
        onReadyCallback(null, userId); // Pass null for db if init failed
        return Promise.reject(error);
    }
}

/**
 * Sets up a real-time listener for the chat messages.
 * @param {Function} updateChatHistory - Callback function to receive the sorted message array.
 */
export function setupChatListener(updateChatHistory) {
    if (!db || !userId) {
        console.error("Firestore not ready. Cannot set up listener.");
        return;
    }

    // Path: /artifacts/{appId}/users/{userId}/chats
    const messagesRef = collection(db, "artifacts", appId, "users", userId, "chats");
    const q = query(messagesRef);

    return onSnapshot(q, (snapshot) => {
        let messages = [];
        snapshot.forEach(doc => {
            messages.push({ id: doc.id, ...doc.data() });
        });

        // Manually sort by timestamp (Firestore order is avoided due to index requirements)
        messages.sort((a, b) => {
            const aTime = a.timestamp ? a.timestamp.toDate().getTime() : Infinity;
            const bTime = b.timestamp ? b.timestamp.toDate().getTime() : Infinity;
            return aTime - bTime;
        });

        updateChatHistory(messages);
    }, (error) => {
        console.error("Error listening to chat messages:", error);
        // Propagate error back to main.js if needed
    });
}

/**
 * Saves a new message to Firestore.
 * @param {string} text - The message content.
 * @param {'user'|'bot'} role - The sender role.
 * @param {boolean} [isCrisis=false] - Flag for crisis messages.
 */
export async function saveMessage(text, role, isCrisis = false) {
    if (!db || !userId) {
        console.warn("Database not available. Message not saved:", text);
        return;
    }
    const messagesRef = collection(db, "artifacts", appId, "users", userId, "chats");
    
    // Use doc() without args to auto-generate a document ID
    await setDoc(doc(messagesRef), {
        text: text,
        role: role,
        isCrisis: isCrisis,
        timestamp: serverTimestamp(),
    });
}
