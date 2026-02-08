import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const menuOptions = [
  {
    id: 'empleados',
    title: 'Empleados',
    description: 'Gestiona tu equipo de trabajo',
    icon: 'people',
    color: '#6172FD',
    screen: 'EmpleadosList',
  },
  {
    id: 'trazabilidad',
    title: 'Trazabilidad',
    description: 'Historial de actividad del sistema',
    icon: 'eye',
    color: '#10B981',
    screen: 'Trazabilidad',
  },
];

const EmpleadosMenuScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Equipo</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Opciones</Text>
        
        {menuOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={styles.menuCard}
            onPress={() => navigation.navigate(option.screen)}
          >
            <View style={[styles.iconContainer, { backgroundColor: option.color + '20' }]}>
              <Ionicons name={option.icon as any} size={28} color={option.color} />
            </View>
            <View style={styles.menuInfo}>
              <Text style={styles.menuTitle}>{option.title}</Text>
              <Text style={styles.menuDescription}>{option.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    height: 120,
    backgroundColor: '#6172FD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 45,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Montserrat_700Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Montserrat_700Bold',
    color: '#374151',
    marginBottom: 16,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuInfo: {
    flex: 1,
    marginLeft: 14,
  },
  menuTitle: {
    fontSize: 16,
    fontFamily: 'Montserrat_700Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  menuDescription: {
    fontSize: 13,
    fontFamily: 'Montserrat_400Regular',
    color: '#6B7280',
  },
});

export default EmpleadosMenuScreen;
