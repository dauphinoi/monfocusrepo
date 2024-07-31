from django.db import IntegrityError, models
from django.contrib.auth.models import User
from django.utils.text import slugify

class Institution(models.Model):
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=50, choices=[
        ('soutien_scolaire', 'Soutien scolaire'),
        ('education_superieur', 'Éducation supérieur'),
        ('formation_pro', 'Formation professionnelle'),
        ('autre', 'Autre')
    ])
    contact_name = models.CharField(max_length=100)
    email = models.EmailField()
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    auth_key = models.CharField(max_length=255, unique=True)  # Clé d'API pour l'authentification SSO

    def __str__(self):
        return self.name

class Teacher(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='teacher')
    STATUS_CHOICES = [
        ('enseignant', 'Je suis enseignant(e) en activité'),
        ('retraite', 'Je suis enseignant(e) à la retraite'),
        ('etudiant', 'Je suis étudiant(e)'),
        ('salarie', 'Je suis salarié(e) ou indépendant(e)'),
        ('autre', 'J\'ai un autre profil'),
    ]

    CIVILITE_CHOICES = [
        ('Madame', 'Madame'),
        ('Monsieur', 'Monsieur'),
    ]

    # Personal Information
    civilite = models.CharField(max_length=10, choices=CIVILITE_CHOICES, default='Madame')
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    birth_date = models.DateField(blank=True, null=True)
    email = models.EmailField()  # Ajout du champ email
    institution = models.ForeignKey(Institution, on_delete=models.SET_NULL, null=True, blank=True, related_name='teachers')
    institution_user_id = models.CharField(max_length=100, null=True, blank=True)

    # Professional Status
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, blank=True)
    
    # Educational Background
    has_bac_plus_trois = models.BooleanField(default=False)
    highest_degree_earned = models.CharField(max_length=150, blank=True, null=True)
    cv = models.FileField(upload_to='cvs/', blank=True, null=True)

    # Subjects and Levels
    subjects = models.ManyToManyField('Subject', through='TeacherSubject')

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name}"
    
    def save(self, *args, **kwargs):
        try:
            if not self.pk and not self.user:  # New Teacher without a User
                username = slugify(f"{self.first_name}.{self.last_name}").lower()
                try:
                    self.user = User.objects.create_user(
                        username=username,
                        email=self.email,
                        password=User.objects.make_random_password(),
                        first_name=self.first_name,
                        last_name=self.last_name
                    )
                except IntegrityError:
                    # Handle username collision
                    username = f"{username}{User.objects.count()}"
                    self.user = User.objects.create_user(
                        username=username,
                        email=self.email,
                        password=User.objects.make_random_password(),
                        first_name=self.first_name,
                        last_name=self.last_name
                    )
            elif self.user:  # Existing Teacher
                self.user.email = self.email  # Update email
                self.user.save()
            super(Teacher, self).save(*args, **kwargs)
        except Exception as e:
            # Handle other exceptions or log errors
            pass

class Subject(models.Model):
    id = models.AutoField(primary_key=True, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class TeacherSubject(models.Model):
    teacher = models.ForeignKey(Teacher, on_delete=models.CASCADE)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    levels = models.CharField(max_length=100)  # This could be further normalized if necessary

    def __str__(self):
        return f"{self.teacher} teaches {self.subject}"

class Level(models.Model):
    id = models.AutoField(primary_key=True, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class CoursType(models.Model):
    id = models.AutoField(primary_key=True, unique=True)
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class Visitor(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='visitor')
    PROFILE_CHOICES = [
        ('parent', 'Parent'),
        ('student', 'Étudiant'),
        ('child', 'Élève'),
    ]
    profile_type = models.CharField(max_length=20, choices=PROFILE_CHOICES)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    email = models.EmailField(primary_key=True, unique=True)  # Utiliser email comme identifiant unique
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    city_or_postal_code = models.CharField(max_length=100)
    level = models.ForeignKey(Level, on_delete=models.SET_NULL, null=True)
    institution = models.ForeignKey(Institution, on_delete=models.SET_NULL, null=True, blank=True, related_name='visitors')
    institution_user_id = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return f"{self.profile_type} - {self.first_name} {self.last_name}"

    def save(self, *args, **kwargs):
        if not self.user:
            # Créer un utilisateur associé si aucun n'existe
            username = self.email  # Utiliser l'email comme nom d'utilisateur
            try:
                self.user = User.objects.create_user(
                    username=username,
                    email=self.email,
                    password=User.objects.make_random_password(),
                    first_name=self.first_name,
                    last_name=self.last_name
                )
            except IntegrityError:
                # Gérer le cas où l'utilisateur existe déjà
                self.user = User.objects.get(email=self.email)
                self.user.first_name = self.first_name
                self.user.last_name = self.last_name
                self.user.save()

        super().save(*args, **kwargs)

    def get_courses(self):
        return VisitorSubjectCourse.objects.filter(visitor=self)

class VisitorSubjectCourse(models.Model):
    visitor = models.ForeignKey(Visitor, on_delete=models.CASCADE, related_name='subject_courses')
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE)
    cours_type = models.ForeignKey(CoursType, on_delete=models.CASCADE)
    teacher = models.ForeignKey(Teacher, on_delete=models.SET_NULL, null=True, related_name='taught_courses')

    class Meta:
        unique_together = ('visitor', 'subject', 'cours_type')

    def __str__(self):
        return f"{self.visitor} - {self.subject} - {self.cours_type}"