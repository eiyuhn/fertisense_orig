// app/index.tsx
import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function SplashScreen() {
  const router = useRouter();

  const goLogin = () => router.push('/login');
  const goRegister = () => router.push('/register');
  const goGuest = () => router.push('/guest/tabs/guest-home'); 
  // If your folder is a route group "(guest)", use:
  // const goGuest = () => router.push('/(guest)/tabs/guest-home');

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/fertisense-logo.png')}
        style={styles.logo}
        resizeMode="contain"
      />
      <Text style={styles.tagline}>
        Alamin ang tamang pag abono.{"\n"}Palaguin ang Pananim ng Totoo.
      </Text>
      <View style={styles.dividerLine} />
      <Text style={styles.englishTagline}>Know What to Apply. Grow What You Need.</Text>

      <TouchableOpacity style={styles.loginButton} onPress={goLogin}>
        <Text style={styles.buttonText}>LOG IN</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.guestButton} onPress={goGuest}>
        <Text style={styles.guestButtonText}>CONTINUE AS GUEST</Text>
      </TouchableOpacity>

      <View style={styles.orWrapper}>
        <View style={styles.line} />
        <Text style={styles.orText}>or</Text>
        <View style={styles.line} />
      </View>

      <TouchableOpacity onPress={goRegister}>
        <Text style={styles.createAccountText}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:'#ffffff',alignItems:'center',justifyContent:'center',paddingHorizontal:24},
  logo:{width:150,height:250,marginBottom:-20,marginTop:-100},
  tagline:{fontSize:22,fontStyle:'italic',fontWeight:'bold',textAlign:'center',color:'#111',marginBottom:0,lineHeight:24},
  dividerLine:{width:'90%',height:1,backgroundColor:'#ccc',marginVertical:17},
  englishTagline:{fontSize:16,fontWeight:'bold',color:'#333',textAlign:'center',marginBottom:100},
  loginButton:{backgroundColor:'#2e7d32',paddingVertical:14,paddingHorizontal:40,borderRadius:50,width:'90%',marginBottom:12},
  guestButton:{borderColor:'#2e7d32',borderWidth:2,paddingVertical:14,paddingHorizontal:40,borderRadius:50,width:'90%',marginBottom:12},
  buttonText:{color:'#fff',textAlign:'center',fontWeight:'bold',letterSpacing:1},
  guestButtonText:{color:'#2e7d32',textAlign:'center',fontWeight:'bold',letterSpacing:1},
  orWrapper:{flexDirection:'row',alignItems:'center',width:'100%',marginVertical:16},
  line:{flex:2,height:1,backgroundColor:'#ccc'},
  orText:{marginHorizontal:12,fontSize:15,color:'#666'},
  createAccountText:{fontSize:17,color:'#2e7d32',fontWeight:'600',textDecorationLine:'underline',marginTop:30},
});
