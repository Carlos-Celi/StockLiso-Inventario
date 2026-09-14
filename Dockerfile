FROM node:20-alpine

# Install Java JRE (needed for Firebase emulator suite)
RUN apk add --no-cache openjdk21-jre bash

# Install Firebase CLI
RUN npm install -g firebase-tools

# Work directory inside container
WORKDIR /app

# Expose Firebase Emulator ports
# 4000: UI, 5000: Hosting, 8080: Firestore, 9099: Auth, 9199: Storage
EXPOSE 4000 5000 8080 9099 9199

# Start emulators importing/exporting to ./emulator_data
CMD ["firebase", "emulators:start", "--import=./emulator_data", "--export-on-exit"]
