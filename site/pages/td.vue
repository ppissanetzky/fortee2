<template>
  <div>
    <!-- DIALOG FOR USERS -->
    <v-dialog
      v-model="userDialog"
      max-width="375"
    >
      <v-card v-if="user">
        <v-toolbar flat color="secondary" class="white--text mb-3">
          <v-toolbar-title>
            {{ user.name }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn small outlined color="white" @click="userDialog=false">
            cancel
          </v-btn>
        </v-toolbar>
        <v-card-actions>
          <v-select
            v-model="user.type"
            dense
            hide-details
            outlined
            label="Type"
            :items="['blocked', 'guest', 'standard']"
          />
        </v-card-actions>
        <v-card-actions>
          <v-text-field
            v-model="user.prefs.displayName"
            dense
            hide-details
            outlined
            label="Display name"
          />
        </v-card-actions>
        <v-card-actions>
          <v-spacer />
          <strong class="red--text pr-2">{{ error }}</strong>
          <v-btn
            outlined
            color="primary"
            :loading="saving"
            :disabled="!!error"
            @click="saveUser"
          >
            save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- DIALOG FOR TOURNAMENTS -->
    <v-dialog
      v-model="dialog"
      max-width="800"
    >
      <v-card v-if="editing">
        <v-toolbar flat color="secondary" class="white--text mb-3">
          <v-toolbar-title>
            {{ editing.id ? `Tournament ${editing.id}` : 'New tournament' }}
          </v-toolbar-title>
          <v-spacer />
          <v-btn small outlined color="white" class="mr-1" @click="duplicate">
            duplicate
          </v-btn>
          <v-btn small outlined color="white" @click="dialog=false">
            cancel
          </v-btn>
        </v-toolbar>
        <v-card-actions>
          <v-text-field
            v-model="editing.name"
            dense
            label="Name"
            outlined
            hide-details
          />
        </v-card-actions>
        <v-card-actions>
          <v-select
            v-model="editing.every"
            dense
            hide-details
            outlined
            label="Runs every"
            class="mr-2"
            :items="every"
            clearable
            :disabled="!editing.every"
          />
          <v-text-field
            v-model="editing.openTime"
            dense
            label="Opens at"
            outlined
            hide-details
            class="mr-2"
          />
          <v-text-field
            v-model="editing.closeTime"
            dense
            label="Closes at"
            outlined
            hide-details
            class="mr-2"
          />
          <v-text-field
            v-model="editing.startTime"
            dense
            label="Starts at"
            outlined
            hide-details
          />
        </v-card-actions>
        <v-card-actions>
          <v-select
            v-model="editing.partner"
            dense
            hide-details
            outlined
            label="Partner"
            class="mr-2"
            :items="partners"
          />
          <v-text-field
            v-model="editing.host"
            dense
            label="Host"
            outlined
            hide-details
          />
        </v-card-actions>
        <!-- RULES -->
        <Rules v-model="editing.rules" class="pa-2" />
        <v-card-actions>
          <v-btn
            v-if="editing.id"
            outlined
            color="error"
            class="mr-3"
            :disabled="!sure"
            @click="remove"
          >
            delete
          </v-btn>
          <v-checkbox
            v-if="editing.id"
            v-model="sure"
            label="Are you sure?"
          />
          <v-spacer />
          <strong class="red--text pr-2">{{ error }}</strong>
          <v-btn
            outlined
            color="primary"
            :loading="saving"
            :disabled="!!error"
            @click="save"
          >
            save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
    <!-- MAIN  -->
    <v-toolbar>
      <v-toolbar-title>TD</v-toolbar-title>
      <template #extension>
        <v-tabs v-model="tab">
          <v-tabs-slider />
          <v-tab>Users</v-tab>
          <v-tab>Today's</v-tab>
          <v-tab>Recurring</v-tab>
        </v-tabs>
      </template>
    </v-toolbar>

    <v-tabs-items v-model="tab">
      <v-tab-item>
        <v-toolbar flat>
          <v-select
            v-model="userType"
            :items="['blocked', 'guest', 'standard']"
            hide-details
            dense
            outlined
            label="Type"
          />
        </v-toolbar>
        <v-data-table
          :headers="userHeaders"
          :items="users"
          :search="search"
          item-key="id"
          @click:row="editUser"
        />
      </v-tab-item>
      <v-tab-item>
        <v-data-table
          :headers="headers.filter(({value}) => value !== 'every')"
          :items="todays"
          :search="search"
          item-key="id"
          @click:row="edit"
        />
      </v-tab-item>
      <v-tab-item>
        <v-toolbar flat>
          <v-select
            v-model="everyFilter"
            :items="every"
            multiple
            hide-details
            dense
            outlined
            clearable
            label="Days"
          />
          <v-text-field
            v-model="search"
            append-icon="mdi-magnify"
            label="Search"
            single-line
            hide-details
            dense
            outlined
            clearable
            class="px-4"
          />
        </v-toolbar>
        <v-data-table
          :headers="headers"
          :items="recurring"
          :search="search"
          item-key="id"
          @click:row="edit"
        />
      </v-tab-item>
    </v-tabs-items>
  </div>
</template>
<script>
export default {
  data () {
    return {
      ts: [],
      todays: [],
      users: [],
      headers: [
        { text: 'Name', value: 'name' },
        { text: 'Every', value: 'every', groupable: true },
        { text: 'Opens', value: 'openTime', align: 'end' },
        { text: 'Closes', value: 'closeTime', align: 'end' },
        { text: 'Starts', value: 'startTime', align: 'end' },
        { text: 'Rules', value: 'rulesDesc' }
      ],
      every: [
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday',
        'Saturday', 'Sunday', 'Every day', 'Weekdays'
      ],
      partners: [
        { value: 1, text: 'Random' },
        { value: 2, text: 'Choose' }
      ],
      userHeaders: [
        { text: 'Name', value: 'name' },
        { text: 'Display name', value: 'prefs.displayName' },
        { text: 'E-mail', value: 'email' },
        { text: 'Type', value: 'type' }
      ],
      // Models
      search: undefined,
      dialog: false,
      userDialog: false,
      user: undefined,
      editing: undefined,
      saving: false,
      error: undefined,
      tab: undefined,
      sure: false,
      everyFilter: [],
      userType: 'guest'
    }
  },
  async fetch () {
    await this.loadUsers()
    const { t } = this.$route.query
    if (t) {
      await this.loadToday()
      this.tab = 1
      const tid = parseInt(t, 10)
      const f = this.todays.find(({ id }) => id === tid)
      if (f) {
        this.edit(f)
      }
    }
  },
  computed: {
    recurring () {
      if (this.everyFilter.length > 0) {
        return this.ts.filter(t => this.everyFilter.includes(t.every))
      }
      return this.ts
    }
  },
  watch: {
    async tab () {
      if (this.tab === 1 && this.todays.length === 0) {
        return await this.loadToday()
      }
      if (this.tab === 2 && this.ts.length === 0) {
        return await this.loadRecurring()
      }
    },
    async userType () {
      await this.loadUsers()
    }
  },
  methods: {
    async loadUsers () {
      const url = `/api/tournaments/td/users/${this.userType}`
      this.users = await this.$axios.$get(url)
    },
    async loadToday () {
      const { tournaments } = await this.$axios.$get('/api/tournaments/td/today')
      this.todays = tournaments
    },
    async loadRecurring () {
      const { tournaments } = await this.$axios.$get('/api/tournaments/td')
      this.ts = tournaments
    },
    edit (t) {
      this.editing = JSON.parse(JSON.stringify(t))
      this.sure = false
      this.dialog = true
    },
    editUser (u) {
      this.user = JSON.parse(JSON.stringify(u))
      this.userDialog = true
    },
    duplicate () {
      this.editing = JSON.parse(JSON.stringify(this.editing))
      this.editing.id = 0
      this.editing.name = ''
      this.editing.signup_opened = 0
      this.editing.signup_closed = 0
      this.editing.started = 0
      this.editing.scheduled = 0
      this.editing.finished = 0
      this.editing.recurring_source = 0
    },
    async save () {
      this.saving = true
      try {
        const { tournament, error } =
          await this.$axios.$post('/api/tournaments/td/save', this.editing)
        if (error) {
          this.error = error
          return setTimeout(() => { this.error = undefined }, 3000)
        }
        const list = tournament.recurring ? this.ts : this.todays
        const i = list.findIndex(({ id }) => id === tournament.id)
        if (i >= 0) {
          list.splice(i, 1, tournament)
        } else if (tournament.recurring) {
          await this.loadRecurring()
        } else {
          await this.loadToday()
        }
        this.dialog = false
      } finally {
        this.saving = false
      }
    },
    async saveUser () {
      this.saving = true
      try {
        const { error } =
          await this.$axios.$post('/api/tournaments/td/save/user', this.user)
        if (error) {
          this.error = error
          return setTimeout(() => { this.error = undefined }, 3000)
        }
        await this.loadUsers()
        this.userDialog = false
      } finally {
        this.saving = false
      }
    },
    async remove () {
      this.saving = true
      try {
        const { id, recurring } = this.editing
        const { error } =
          await this.$axios.$get(`/api/tournaments/td/delete/${id}`)
        if (error) {
          this.error = error
          return setTimeout(() => { this.error = undefined }, 3000)
        }
        const list = recurring ? this.ts : this.todays
        const i = list.findIndex(t => t.id === id)
        if (i >= 0) {
          list.splice(i, 1)
        }
        this.dialog = false
      } finally {
        this.saving = false
      }
    }
  }
}
</script>
