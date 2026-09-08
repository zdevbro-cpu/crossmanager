
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: "https://crossmanager-482403-default-rtdb.firebaseio.com" // Use correct DB URL if known, or omit if only Auth
    });
}

const users = [
    { email: 'emp1@cross.com', password: 'cross123', displayName: '김철수 (Emp1)', role: 'Admin' },
    { email: 'emp2@cross.com', password: 'cross123', displayName: '이영희 (Emp2)', role: 'Manager' },
    { email: 'emp3@cross.com', password: 'cross123', displayName: '박민수 (Emp3)', role: 'Admin' }
];

async function createUsers() {
    console.log('Creating users...');
    for (const user of users) {
        try {
            // Check if user exists
            try {
                const existingUser = await admin.auth().getUserByEmail(user.email);
                console.log(`User ${user.email} already exists (UID: ${existingUser.uid}). Updating password and role...`);
                await admin.auth().updateUser(existingUser.uid, {
                    password: user.password,
                    displayName: user.displayName
                });
                // Always update role
                await admin.auth().setCustomUserClaims(existingUser.uid, { role: user.role });
                console.log(`Updated ${user.email} with role '${user.role}'`);
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    const newUser = await admin.auth().createUser({
                        email: user.email,
                        password: user.password,
                        displayName: user.displayName,
                    });
                    console.log(`Created new user: ${newUser.email} (UID: ${newUser.uid})`);

                    // Set Custom Claims for Role
                    await admin.auth().setCustomUserClaims(newUser.uid, { role: user.role });
                    console.log(`Set role '${user.role}' for ${user.email}`);
                } else {
                    throw error;
                }
            }
        } catch (err) {
            console.error(`Failed to process ${user.email}:`, err.message);
        }
    }
    console.log('Done.');
    process.exit(0); // Explicitly exit to close script
}

createUsers();
