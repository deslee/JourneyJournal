#keytool -genkey -v -keystore keys/release-key.keystore -alias deskey -keyalg RSA -keysize 2048 -validity 10000

jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore ../../keys/release-key.keystore $1 deskey

/Users/desmond/AppData/Local/Android/sdk/build-tools/21.1.2/zipalign.exe -v 4 $1 ./Journey-signed.apk
