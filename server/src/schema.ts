import { permissions } from './permissions'
import { APP_SECRET, getUserId } from './utils'
import { compare, hash } from 'bcryptjs'
import { sign } from 'jsonwebtoken'
import { applyMiddleware } from 'graphql-middleware'
import {
  intArg,
  makeSchema,
  nonNull,
  objectType,
  stringArg,
  inputObjectType,
  arg,
  asNexusMethod,
  enumType,
} from 'nexus'
import { DateTimeResolver } from 'graphql-scalars'
import { Context } from './context'

export const DateTime = asNexusMethod(DateTimeResolver, 'date')

const Query = objectType({
  name: 'Query',
  definition(t) {
    t.nonNull.list.nonNull.field('allUsers', {
      type: 'User',
      resolve: (_parent, _args, context: Context) => {
        return context.prisma.user.findMany()
      },
    })

    t.nullable.field('me', {
      type: 'User',
      resolve: (parent, args, context: Context) => {
        const userId = getUserId(context)
        return context.prisma.user.findUnique({
          where: {
            id: Number(userId),
          },
        })
      },
    })

    t.nullable.field('workoutById', {
      type: 'Workout',
      args: {
        id: intArg(),
      },
      resolve: (_parent, args, context: Context) => {
        return context.prisma.workout.findUnique({
          where: { id: args.id || undefined },
        })
      },
    })
  },
})

const Mutation = objectType({
  name: 'Mutation',
  definition(t) {
    t.field('signup', {
      type: 'AuthPayload',
      args: {
        name: stringArg(),
        email: nonNull(stringArg()),
        password: nonNull(stringArg()),
      },
      resolve: async (_parent, args, context: Context) => {
        const hashedPassword = await hash(args.password, 10)
        const user = await context.prisma.user.create({
          data: {
            name: args.name,
            email: args.email,
            password: hashedPassword,
          },
        })
        return {
          token: sign({ userId: user.id }, APP_SECRET),
          user,
        }
      },
    })

    t.field('login', {
      type: 'AuthPayload',
      args: {
        email: nonNull(stringArg()),
        password: nonNull(stringArg()),
      },
      resolve: async (_parent, { email, password }, context: Context) => {
        const user = await context.prisma.user.findUnique({
          where: {
            email,
          },
        })
        if (!user) {
          throw new Error(`No user found for email: ${email}`)
        }
        const passwordValid = await compare(password, user.password)
        if (!passwordValid) {
          throw new Error('Invalid password')
        }
        return {
          token: sign({ userId: user.id }, APP_SECRET),
          user,
        }
      },
    })

    t.field('deleteWorkout', {
      type: 'Workout',
      args: {
        id: nonNull(intArg()),
      },
      resolve: (_, args, context: Context) => {
        return context.prisma.workout.delete({
          where: { id: args.id },
        })
      },
    })

    t.field('createWorkout', {
      type: 'Workout',
      args: {
        title: nonNull(stringArg())
      },
      resolve: (_, args, context: Context) => {
        const userId = getUserId(context)
        return context.prisma.workout.create({
          data: {
            title: args.title,
            authorId: userId,
          },
        })
      },
    })

    t.field('createExercise', {
      type: 'Exercise',
      args: {
        id: nonNull(intArg()),
        title: stringArg(),
        weight: nonNull(intArg()),
        reps: nonNull(intArg()),
        sets: nonNull(intArg()),
      },
      resolve: (parent, args, context: Context) => {
        const userId = getUserId(context)
        if (!userId) throw new Error('Could not authenticate user.')
        return context.prisma.exercise.create({
          data: {
            title: args.title,
            weight: args.weight,
            reps: args.reps,
            sets: args.sets,
            parent: {connect: { id: Number(args.id) } }
          }
        })
      }
    })

    t.field('deleteExercise', {
      type: 'Exercise',
      args: {
        id: nonNull(intArg()),
      },
      resolve: (_, args, context: Context) => {
        return context.prisma.exercise.delete({
          where: { id: args.id },
        })
      },
    })
  },
})

const User = objectType({
  name: 'User',
  definition(t) {
    t.nonNull.int('id')
    t.string('name')
    t.nonNull.string('email')
    t.nonNull.list.nonNull.field('workouts', {
      type: 'Workout',
      resolve: (parent, _, context: Context) => {
        return context.prisma.user
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .workouts()
      },
    })
  },
})

const Workout = objectType({
  name: 'Workout',
  definition(t) {
    t.nonNull.int('id')
    t.nonNull.field('createdAt', { type: 'DateTime' })
    t.nonNull.field('updatedAt', { type: 'DateTime' })
    t.nonNull.string('title')
    t.nonNull.list.nonNull.field('exercises', {
      type: 'Exercise',
      resolve: (parent, _, context: Context) => {
        return context.prisma.workout
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .exercises()
      },
    })
    t.nonNull.boolean('published')
    t.nonNull.int('viewCount')
    t.field('author', {
      type: 'User',
      resolve: (parent, _, context: Context) => {
        return context.prisma.workout
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .author()
      },
    })
  },
})

const Exercise = objectType({
  name: 'Exercise',
  definition(t) {
    t.nonNull.string('title')
    t.nonNull.int('id')
    t.nonNull.int('reps')
    t.nonNull.int('sets')
    t.nonNull.int('weight')
    t.field('parent', {
      type: 'Workout',
      resolve: (parent, _, context: Context) => {
        return context.prisma.exercise
          .findUnique({
            where: { id: parent.id || undefined },
          })
          .parent()
      },
    })
  },
})

const SortOrder = enumType({
  name: 'SortOrder',
  members: ['asc', 'desc'],
})

const UserUniqueInput = inputObjectType({
  name: 'UserUniqueInput',
  definition(t) {
    t.int('id')
    t.string('email')
  },
})

const WorkoutCreateInput = inputObjectType({
  name: 'WorkoutCreateInput',
  definition(t) {
    t.nonNull.string('title')
  },
})

const UserCreateInput = inputObjectType({
  name: 'UserCreateInput',
  definition(t) {
    t.nonNull.string('email')
    t.string('name')
    t.list.nonNull.field('posts', { type: 'WorkoutCreateInput' })
  },
})

const AuthPayload = objectType({
  name: 'AuthPayload',
  definition(t) {
    t.string('token')
    t.field('user', { type: 'User' })
  },
})

const schemaWithoutPermissions = makeSchema({
  types: [
    Query,
    Mutation,
    Workout,
    Exercise,
    User,
    AuthPayload,
    UserUniqueInput,
    UserCreateInput,
    WorkoutCreateInput,
    SortOrder,
    DateTime,
  ],
  outputs: {
    schema: __dirname + '/../schema.graphql',
    typegen: __dirname + '/generated/nexus.ts',
  },
  contextType: {
    module: require.resolve('./context'),
    export: 'Context',
  },
  sourceTypes: {
    modules: [
      {
        module: '@prisma/client',
        alias: 'prisma',
      },
    ],
  },
})

export const schema = applyMiddleware(schemaWithoutPermissions, permissions)
