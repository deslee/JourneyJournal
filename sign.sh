#keytool -genkey -v -keystore keys/release-key.keystore -alias deskey -keyalg RSA -keysize 2048 -validity 10000

jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore ../../keys/release-key.keystore platforms/android/ant-build/MainActivity-release-unsigned.apk deskey

C:/Users/desmond/AppData/Local/Android/sdk/build-tools/21.1.2/zipalign.exe -v 4 platforms\android\ant-build\MainActivity-release-unsigned.apk ./Journey-signed.apk
