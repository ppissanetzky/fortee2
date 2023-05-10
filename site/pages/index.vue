<template>
  <div>
    <v-sheet class="d-flex justify-space-around mb-6" style="margin-top: 100px;">
      <v-img max-width="400" width="400" src="/logo.png" />
    </v-sheet>
    <v-sheet class="d-flex justify-space-around">
      <div id="google-button" />
    </v-sheet>
  </div>
</template>
<script>
export default {
  data () {
    return {}
  },
  async fetch () {
    try {
      await this.$axios.$get('/api/tournaments/me')
      window.open('/main/', '_top')
    } catch (error) {
      if (error?.response?.status === 401) {
        return this.renderGoogleButton()
      }
      throw error
    }
  },
  mounted () {
  },
  methods: {
    renderGoogleButton () {
      const gis = document.createElement('script')
      gis.setAttribute('src', 'https://accounts.google.com/gsi/client')
      document.head.appendChild(gis)
      gis.onload = () => {
        function handleCredentialsResponse (value) {
          const { credential } = value
          window.open(`/api/login/google?credential=${encodeURIComponent(credential)}`, '_top')
        }
        // eslint-disable-next-line no-undef
        google.accounts.id.initialize({
          client_id: '539882529096-oqp7qpthd98qftj9orihpe0vvcn2gtoc.apps.googleusercontent.com',
          callback: handleCredentialsResponse,
          prompt_parent_id: 'prompt',
          context: 'signup'
        })
        // eslint-disable-next-line no-undef
        google.accounts.id.renderButton(document.getElementById('google-button'), {
          type: 'standard'
        })
        if (this.$route.query.signout) {
          // eslint-disable-next-line no-undef
          google.accounts.id.disableAutoSelect()
        }
      }
    }
  }
}
</script>
